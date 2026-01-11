/**
 * Maintenance Dashboard - COMPLETE Implementation
 * All 54 functions from legacy maintenance.js
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Wrench, LogOut as LogOutIcon, ShoppingCart,
    Users, MessageSquare, History, Camera, AlertTriangle,
    CheckCircle, Clock, Play, PauseCircle, PlayCircle, X, Image, Trash2, FileText,
    DollarSign, Zap, Activity, Building2, Settings, Eye,
    QrCode, // ✅ QR icon for QR requests
    Smartphone, // ✅ Alternative QR icon
    BookOpen // ✅ General instructions icon
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { usei18n } from '../../i18n/i18nContext';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, Timestamp, orderBy, getDocs } from 'firebase/firestore';
import { useSmartAgent } from '../../hooks/useSmartAgent';
import { useOnboardingTour } from '../../hooks/useOnboardingTour'; // ✅ Onboarding tour
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ Tour guide component
// DeveloperSignature is now in GlobalFooter (App.tsx)
import VoiceInputButton from '../../components/shared/VoiceInputButton';

// Shared Components
import { ProcurementCart } from '../../components/shared/ProcurementCart';
import { PointsTracker } from '../../components/shared/PointsTracker';
import { ShiftNotes } from '../../components/shared/ShiftNotes';
import { HistoryFilter } from '../../components/shared/HistoryFilter';
import { TeamMembers } from '../../components/shared/TeamMembers';
import { UnifiedHistoryModal } from '../../components/shared/UnifiedHistoryModal';
import { useTenant } from '../../context/TenantContext'; // ✅ Added import
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
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { TransferNotificationBadge } from '../../components/guest/TransferNotificationBadge'; // ✅ Room transfer notifications

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
    createdAt: any;
    timeline?: {
        confirmed?: any;
        started?: any;
        completed?: any;
    };
    // Department tracking
    currentDepartment?: 'maintenance' | 'reception' | 'housekeeping';
    [key: string]: any;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const MaintenanceDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { success, error, haptic } = useUX();
    const { tenantId, setTenant } = useTenant(); // ✅ Use Tenant Context - moved early

    // State
    const [currentTab, setCurrentTab] = useState<'active' | 'completed'>('active');
    const [loading, setLoading] = useState(true);
    
    // ✅ FAST UI: Force show page after 2 seconds max
    useEffect(() => {
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                console.log('⚡ Fast UI: Showing Maintenance page now');
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
            if (tab === 'active' || tab === 'completed') {
                setCurrentTab(tab as 'active' | 'completed');
            }
        }, [searchParams]);
    } catch {}

    // Requests
    const [activeRequests, setActiveRequests] = useState<MaintenanceRequest[]>([]);
    const [completedRequests, setCompletedRequests] = useState<MaintenanceRequest[]>([]);

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

    // Filtered requests based on issue type
    const filteredActiveRequests = useMemo(() => {
        if (issueTypeFilter === 'all') return activeRequests;
        return activeRequests.filter(r =>
            (r.maintenanceType || '').toLowerCase().includes(issueTypeFilter) ||
            (r.description || '').toLowerCase().includes(issueTypeFilter)
        );
    }, [activeRequests, issueTypeFilter]);

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
                console.error('Location check error:', err);
                // Fail open - allow access
            }
        };
        
        checkLocation();
    }, [tenantId, branchId, user?.branches]);

    useEffect(() => {
        if (!user || !branchId) return;

        // ✅ Auto-sync tenant if missing (Crucial for direct navigation)
        const userTenantId = (user as any)?.tenantId;
        if (userTenantId && !tenantId) {
            console.log('🔄 Syncing Tenant ID from Auth:', userTenantId);
            setTenant(userTenantId).catch(console.error);
        }

        initMaintenancePage();
    }, [user, tenantId]);

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
            console.log("AI Action Success (Maintenance):", action, params);
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

    const initMaintenancePage = async () => {
        listenToMaintenanceRequests();
        setLoading(false);
        console.log('✅ Maintenance page initialized');
    };

    // ============================================================
    // REALTIME LISTENERS
    // ============================================================

    const listenToMaintenanceRequests = () => {
        const tenantId = (user as any)?.tenantId;

        if (!branchId) return;

        const requestsRef = collection(db, 'requests');

        let constraints = [
            where('branch', '==', branchId),
            where('serviceType', '==', 'maintenance')
        ];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));

        const q = query(
            requestsRef,
            ...constraints,
            orderBy('createdAt', 'desc')
        );

        return onSnapshot(q, (snapshot) => {
            processMaintenanceSnapshot(snapshot);
        }, (error) => {
            console.error('Error listening to maintenance requests:', error);
            // Fallback without orderBy if index missing
            if (error.code === 'failed-precondition') {
                // Re-construct constraints for fallback (reusing constraints array from above)
                const q2 = query(requestsRef, ...constraints);
                onSnapshot(q2, processMaintenanceSnapshot);
            }
        });
    };

    const processMaintenanceSnapshot = (snapshot: any, localSort = false) => {
        const active: MaintenanceRequest[] = [];
        const completed: MaintenanceRequest[] = [];
        const now = new Date();

        // ✅ Helper: Check if scheduled request should be shown (only if scheduledDate <= now)
        const isScheduledRequestVisible = (r: any): boolean => {
            const scheduledDateTime = r.scheduledDate || r.scheduledAt;
            if (!scheduledDateTime) return true; // Not scheduled - always visible
            
            const scheduledTime = scheduledDateTime?.toDate?.() || new Date(scheduledDateTime);
            // Show only if scheduled time has passed (including now)
            return scheduledTime <= now;
        };

        snapshot.forEach((doc: any) => {
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
            } else if (['CONFIRMED', 'IN_PROGRESS', 'WAITING_PARTS', 'SCHEDULED'].includes(request.status)) {
                active.push(request);
            }
        });

        // Sort by priority if local sort needed
        if (localSort) {
            const priorityOrder = { urgent: 0, normal: 1, low: 2 };
            active.sort((a, b) => (priorityOrder[a.priority || 'normal'] || 1) - (priorityOrder[b.priority || 'normal'] || 1));
        }

        setActiveRequests(active);
        setCompletedRequests(completed);
    };

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    const isToday = (timestamp: any): boolean => {
        if (!timestamp) return false;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const getTimeAgo = (timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 60000);
        if (diff < 1) return 'الآن';
        if (diff < 60) return `منذ ${diff} دقيقة`;
        const hours = Math.floor(diff / 60);
        if (hours < 24) return `منذ ${hours} ساعة`;
        return `منذ ${Math.floor(hours / 24)} يوم`;
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
            case 'urgent': return 'عاجل';
            case 'low': return 'منخفض';
            default: return 'عادي';
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
                success('تم رفع صورة قبل الإصلاح');
            } else {
                error('فشل رفع الصورة: ' + (result.error || 'خطأ غير معروف'));
                setBeforePhoto(null);
            }
        } catch (err: any) {
            console.error('Before photo upload error:', err);
            error('فشل رفع الصورة: ' + (err.message || 'خطأ غير معروف'));
            setBeforePhoto(null);
        }
    };

    const removeBeforePhoto = () => {
        setBeforePhoto(null);
    };

    const confirmStart = async () => {
        if (!currentStartRequest) return;

        try {
            const updateData: any = {
                status: 'IN_PROGRESS',
                'timeline.started': Timestamp.now(),
                startedBy: user?.id,
                estimatedCost: getEstimatedCost(currentStartRequest.maintenanceType || 'general')
            };

            if (beforePhoto) {
                updateData.beforePhoto = beforePhoto;
            }

            await updateDoc(doc(db, 'requests', currentStartRequest.id), updateData);

            closeStartModal();
            await addPointToEmployee('start_maintenance', { roomNumber: currentStartRequest.roomNumber });
            success('تم بدء الصيانة بنجاح');
        } catch (err) {
            console.error('Error starting maintenance:', err);
            error('فشل بدء الصيانة');
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
                success('تم رفع الصورة بنجاح');
            } else {
                error('فشل رفع الصورة: ' + (result.error || 'خطأ غير معروف'));
                setAfterPhoto(null);
                setAfterPhotoFile(null);
            }
        } catch (err: any) {
            console.error('Upload error:', err);
            error('فشل رفع الصورة: ' + (err.message || 'خطأ غير معروف'));
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

        // ✅ MANDATORY: After Photo is required
        if (!afterPhoto) {
            error('يجب رفع صورة بعد الإصلاح لإتمام الطلب');
            return;
        }

        // ✅ Check if photo is still uploading
        if (uploadingPhoto) {
            error('يرجى الانتظار حتى يتم رفع الصورة');
            return;
        }

        try {
            // ✅ Use transferRequestToDepartment to properly track the journey
            await transferRequestToDepartment(
                currentCompleteRequest.id,
                'maintenance',
                'housekeeping',
                user?.id || '',
                user?.name || '',
                'NEEDS_INSPECTION' as any, // Status: Needs Inspection
                `تم إتمام الصيانة. ${completionNotes ? `ملاحظات: ${completionNotes}` : ''}`
            );

            // ✅ Update request with completion data and afterPhoto
            const updateData: any = {
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
                console.warn('Could not auto-update room status:', err);
            }

            // ✅ Close modal (don't delete request - it's transferred to housekeeping)
            closeCompleteModal();
            
            // ✅ Award points
            await addPointToEmployee('complete_maintenance', {
                roomNumber: currentCompleteRequest.roomNumber,
                maintenanceType: currentCompleteRequest.maintenanceType
            });
            
            success('تم إتمام الصيانة وإرسالها للفحص في الهاوس كيبنج ✓');
            haptic('success');
        } catch (err: any) {
            console.error('Error completing maintenance:', err);
            error('فشل إتمام الصيانة: ' + (err.message || 'خطأ غير معروف'));
        }
    };

    // ============================================================
    // STATUS ACTIONS (HOLD / RESUME)
    // ============================================================

    const handleHoldRequest = async (request: MaintenanceRequest) => {
        try {
            await updateDoc(doc(db, 'requests', request.id), {
                status: 'WAITING_PARTS',
                'timeline.pausedAt': Timestamp.now()
            });
            success('تم تعليق الطلب لانتظار القطع');
        } catch (err) {
            console.error(err);
            error('فشل تعليق الطلب');
        }
    };

    const handleResumeRequest = async (request: MaintenanceRequest) => {
        try {
            await updateDoc(doc(db, 'requests', request.id), {
                status: 'IN_PROGRESS',
                'timeline.resumedAt': Timestamp.now() // Could be array for multiple pauses
            });
            success('تم استئناف العمل');
        } catch (err) {
            console.error(err);
            error('فشل استئناف الطلب');
        }
    };

    // ============================================================
    // ANALYTICS FUNCTIONS
    // ============================================================

    const getRoomMaintenanceHistory = async (roomNumber: string, limit = 10): Promise<MaintenanceRequest[]> => {
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
            console.error('Error getting room history:', error);
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

    const addPointToEmployee = async (action: string, details: any = {}) => {
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
            console.error('Error adding points:', error);
        }
    };

    // ============================================================
    // TAB SWITCHING
    // ============================================================

    const switchTab = (tabName: 'active' | 'completed') => {
        setCurrentTab(tabName);
    };

    // ============================================================
    // EXPORT FUNCTIONS
    // ============================================================

    const exportMaintenanceDataToCSV = () => {
        const data = [...activeRequests, ...completedRequests];
        const headers = ['الغرفة', 'النوع', 'الحالة', 'التكلفة', 'التاريخ'];
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
        if (user?.id && user?.name) {
            try {
                await markAsViewed(requestId, user.id, user.name, 'maintenance');
            } catch (e) {
                // Silent fail
            }
        }
    };

    const renderMaintenanceCard = (request: MaintenanceRequest) => (
        <div key={request.id} className="glass-card p-4 mb-3" onClick={() => handleCardClick(request.id)}>
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
                    <p className="text-white/60 text-sm line-clamp-2">{request.notes || request.description || 'طلب صيانة'}</p>
                    {/* ✅ QR Badge - Show if request is from QR */}
                    {(request as any).source === 'QR' && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-[10px] font-bold flex items-center gap-1">
                                <QrCode className="w-3 h-3" />
                                <span>طلب من QR</span>
                            </span>
                            {(request as any).guestName && (
                                <span className="text-white/50 text-xs">
                                    النزيل: {(request as any).guestName}
                                    {(request as any).guestIdentity && ` • ${(request as any).guestIdentity}`}
                                    {(request as any).guestPhone && ` • ${(request as any).guestPhone}`}
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-white/40" />
                        <p className="text-white/40 text-xs">{getTimeAgo(request.createdAt)}</p>
                        <ReadReceipt request={request as any} size="sm" showPopup={false} />
                    </div>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col items-end gap-2 pl-2">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold border ${request.status === 'IN_PROGRESS'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                        {request.status === 'IN_PROGRESS' ? 'جاري التنفيذ' : 'انتظار'}
                    </span>

                    {/* View Details Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDetailRequest(request);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
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
                <AdoraLoader size="lg" message="جاري تحميل البيانات..." />
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
            
            <div className="min-h-screen p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6 pb-16 sm:pb-20 md:pb-24 overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            {/* Flexible Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">
                        الصيانة
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white/60 text-sm sm:text-base truncate">{user?.name}</span>
                        <PointsTracker employeeId={user?.id || ''} showHistory={false} inline={true} />
                    </div>
                </div>

                {/* Mobile: Hamburger Menu | Desktop: All buttons visible */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {/* Mobile: Hamburger Menu Button */}
                    <button
                        onClick={() => setShowMobileMenu(true)}
                        className="lg:hidden w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-transform"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    {/* Desktop: All buttons visible */}
                    <div className="hidden lg:flex gap-2">
                        <HeaderButton
                            onClick={() => setShowShiftNotes(true)}
                            icon={<MessageSquare className="w-5 h-5" />}
                            label="ملاحظات الغرف"
                        />

                        <HeaderButton
                            onClick={() => setShowGeneralInstructions(true)}
                            icon={<BookOpen className="w-5 h-5" />}
                            label="تعليمات عامة"
                            variant="primary"
                        />

                        <HeaderButton
                            onClick={() => setShowHistory(true)}
                            icon={<History className="w-5 h-5" />}
                            label="سجل العمليات"
                            variant="primary"
                        />

                        <HeaderButton
                            onClick={() => setShowProcurement(true)}
                            icon={<ShoppingCart className="w-5 h-5" />}
                            label="المشتريات"
                        />

                        <HeaderButton
                            onClick={exportMaintenanceDataToCSV}
                            icon={<FileText className="w-5 h-5" />}
                            label="تصدير"
                        />

                        {!['manager', 'admin', 'owner'].includes(user?.role || '') && (
                            <HeaderButton
                                onClick={logout}
                                icon={<LogOutIcon className="w-5 h-5" />}
                                label="تسجيل خروج"
                                variant="danger"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Golden Alert - Broadcast Messages */}
            <GoldenAlertDisplay department="maintenance" />

            {/* ✅ Room Transfer Notifications */}
            <div className="flex justify-end mb-3">
                <TransferNotificationBadge department="maintenance" />
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

            {/* Stats Cards - Unified Style */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.filter(r => r.status === 'IN_PROGRESS').length}
                        label="🔧 قيد التنفيذ"
                        icon={Activity}
                        iconColor="blue"
                        status="normal"
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.filter(r => r.status === 'CONFIRMED').length}
                        label="⏳ بانتظار البدء"
                        icon={Clock}
                        iconColor="orange"
                        status={activeRequests.filter(r => r.status === 'CONFIRMED').length > 10 ? 'warning' : 'normal'}
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={completedRequests.length}
                        label="✅ مكتملة اليوم"
                        icon={CheckCircle}
                        iconColor="green"
                        status="success"
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={activeRequests.filter(r => r.priority === 'urgent').length}
                        label="🚨 عاجلة"
                        icon={AlertTriangle}
                        iconColor="red"
                        status={activeRequests.filter(r => r.priority === 'urgent').length > 0 ? 'error' : 'normal'}
                        lastUpdate="تم التحديث الآن"
                    />
                </div>
            </div>

            {/* Progress Tracker */}
            <div className="mt-6">
                <TaskProgress
                    completed={completedRequests.length}
                    total={activeRequests.length + completedRequests.length}
                    label="📊 إنجاز اليوم"
                    color="#F59E0B"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 mt-6">
                {[
                    { id: 'active', label: 'النشطة', count: filteredActiveRequests.length },
                    { id: 'completed', label: 'المنجزة', count: filteredCompletedRequests.length }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => switchTab(tab.id as any)}
                        className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${currentTab === tab.id
                            ? 'bg-primary-500 text-white'
                            : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        {tab.label}
                        <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Issue Type Filter */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
                <span className="text-white/40 text-sm flex-shrink-0">نوع العطل:</span>
                {[
                    { key: 'all', label: 'الكل', icon: '🔧' },
                    { key: 'كهرب', label: 'كهرباء', icon: '⚡' },
                    { key: 'سباك', label: 'سباكة', icon: '🚿' },
                    { key: 'تكييف', label: 'تكييف', icon: '❄️' },
                    { key: 'نجار', label: 'نجارة', icon: '🪚' },
                ].map((type) => (
                    <button
                        key={type.key}
                        onClick={() => {
                            setIssueTypeFilter(type.key);
                            haptic('light');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 flex items-center gap-1.5 ${issueTypeFilter === type.key
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                    >
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="space-y-4">
                {currentTab === 'active' && filteredActiveRequests.map(renderMaintenanceCard)}
                {currentTab === 'completed' && filteredCompletedRequests.map(renderMaintenanceCard)}

                {currentTab === 'active' && filteredActiveRequests.length === 0 && (
                    <div className="text-center py-12 text-white/40">لا توجد طلبات صيانة نشطة</div>
                )}
                {currentTab === 'completed' && filteredCompletedRequests.length === 0 && (
                    <div className="text-center py-12 text-white/40">لا توجد طلبات منجزة اليوم</div>
                )}
            </div>

            {/* Details Modal */}
            <RequestDetailsModal
                isOpen={!!selectedDetailRequest}
                request={selectedDetailRequest}
                onClose={() => setSelectedDetailRequest(null)}
            />

            {/* Start Modal */}
            {currentStartRequest && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal - no glass effects */}
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg">
                        <div className="flex justify-between items-center p-4 border-b border-white/10">
                            <h2 className="text-xl font-bold text-white">بدء صيانة غرفة {currentStartRequest.roomNumber}</h2>
                            <button onClick={closeStartModal} className="text-white/60 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Request Details */}
                            <div className="bg-white/5 p-3 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">نوع الصيانة</p>
                                <p className="text-white font-medium">{currentStartRequest.maintenanceType || 'عام'}</p>
                            </div>

                            <div className="bg-white/5 p-3 rounded-xl">
                                <p className="text-white/60 text-sm mb-1">الوصف</p>
                                <p className="text-white">{currentStartRequest.description || 'لا يوجد وصف'}</p>
                            </div>

                            {/* Before Photo */}
                            <div>
                                <label className="block text-white/60 mb-2">صورة قبل الإصلاح</label>
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
                                        className="w-full py-8 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center gap-2 text-white/40"
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
                                    <h2 className="text-xl font-bold text-white">إتمام صيانة</h2>
                                    <p className="text-sm text-white/60">غرفة {currentCompleteRequest.roomNumber}</p>
                                </div>
                            </div>
                            <button 
                                onClick={closeCompleteModal} 
                                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content - Scrollable */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
                            {/* Request Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-white/60 text-xs mb-1">نوع الصيانة</p>
                                    <p className="text-white font-medium text-sm">{currentCompleteRequest.maintenanceType || 'عام'}</p>
                                </div>
                                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-white/60 text-xs mb-1">الأولوية</p>
                                    <p className={`font-medium text-sm ${currentCompleteRequest.priority === 'urgent' ? 'text-red-400' : 'text-blue-400'}`}>
                                        {currentCompleteRequest.priority === 'urgent' ? '🚨 عاجل' : '⏱️ عادي'}
                                    </p>
                                </div>
                            </div>

                            {/* Completion Notes */}
                            <div>
                                <label className="block text-white/70 text-sm mb-2 font-medium">ملاحظات الإتمام (اختياري)</label>
                                <textarea
                                    value={completionNotes}
                                    onChange={(e) => setCompletionNotes(e.target.value)}
                                    rows={3}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                    placeholder="اكتب أي ملاحظات عن الصيانة المنجزة..."
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
                                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            <ProcurementCart department="maintenance" isOpen={showProcurement} onClose={() => setShowProcurement(false)} />
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
                    },
                    {
                        id: 'export',
                        label: 'تصدير البيانات',
                        icon: <FileText className="w-5 h-5" />,
                        onClick: exportMaintenanceDataToCSV,
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

// ============================================================
// REQUEST DETAILS MODAL
// ============================================================

const RequestDetailsModal: React.FC<{
    isOpen: boolean;
    request: MaintenanceRequest | null;
    onClose: () => void;
}> = ({ isOpen, request, onClose }) => {
    if (!isOpen || !request) return null;

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
                                <h3 className="text-white font-bold">{request.maintenanceType || 'صيانة عامة'}</h3>
                                <p className="text-white/50 text-xs">{request.createdAt?.toDate?.().toLocaleString('ar-SA')}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            {/* ✅ Priority Badge - Always show */}
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${request.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                {request.priority === 'urgent' ? '🚨 عاجل' : '⏱️ عادي'}
                            </span>
                            {/* ✅ Guest Status Badge - Always show */}
                            {request.guestStatus === 'in' ? (
                                <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                                    🏠 نزيل داخل
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                                    🚪 نزيل خارج
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Description/Notes */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <label className="block text-white/40 text-xs mb-2 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            وصف المشكلة (من الاستقبال)
                        </label>
                        <p className="text-white leading-relaxed">
                            {request.notes || request.description || 'لا يوجد وصف'}
                        </p>
                    </div>

                    {/* Images */}
                    {request.damagePhoto && (
                        <div>
                            <label className="block text-white/40 text-xs mb-2">صورة المشكلة</label>
                            <img
                                src={request.damagePhoto}
                                alt="Damage"
                                className="w-full h-48 object-cover rounded-xl border border-white/10"
                                onClick={() => window.open(request.damagePhoto, '_blank')}
                            />
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/10">
                    <button onClick={onClose} className="w-full py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all">
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaintenanceDashboard;
