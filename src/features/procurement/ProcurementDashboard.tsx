/**
 * Procurement Dashboard
 * Manager approval + Procurement rep workflow
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ShoppingCart,
    Check,
    X,
    Clock,
    Truck,
    Package,
    AlertCircle,
    CheckCircle,
    User,
    LogOut,
    Building2,
    History,
    Settings,
    BookOpen
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { useSmartAgent } from '../../hooks/useSmartAgent';
import { useOnboardingTour } from '../../hooks/useOnboardingTour'; // ✅ Onboarding tour
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ Tour guide component
// DeveloperSignature is now in GlobalFooter (App.tsx)
import VoiceInputButton from '../../components/shared/VoiceInputButton';
import { PointsTracker } from '../../components/shared/PointsTracker'; // ✅ Points tracker
import { UnifiedRequestTabs } from '../../components/shared/UnifiedRequestTabs'; // ✅ Unified tabs
import { db } from '../../services/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    Timestamp,
    updateDoc,
    doc
} from 'firebase/firestore';
import {
    ProcurementRequest,
    ProcurementStatus,
    approveProcurement,
    rejectProcurement,
    startPurchasing,
    completePurchase,
    deliverItems,
    confirmReceipt
} from '../../services/procurementService';
import { UnifiedHistoryModal } from '../../components/shared/UnifiedHistoryModal';
import { GoldenAlertDisplay } from '../../components/shared/GoldenAlert';
import { MobileMenu } from '../../components/common/MobileMenu';
import { StatCard } from '../../components/common/StatCard';
import { PointsNotification } from '../../components/shared/PointsNotification';
import { BranchLocationWarning } from '../../components/auth/BranchLocationWarning';
import { checkBranchLocation } from '../../services/branchLocationService';
import { ManagerAnnouncementBanner } from '../../components/shared/ManagerAnnouncementBanner'; // ✅ Manager announcements banner
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { useBrandName } from '../../hooks/useBrandName';
import { ChallengeTimeline } from '../../components/features/ChallengeTimeline'; // ✅ Commitment Timeline
import { PurchaseCompleteModal } from '../../components/procurement/PurchaseCompleteModal'; // ✅ Purchase Complete Modal

// ============================================================
// STATUS CONFIG
// ============================================================

const STATUS_CONFIG: Record<ProcurementStatus, { label: string; color: string; icon: React.ElementType }> = {
    PENDING_APPROVAL: { label: 'بانتظار الموافقة', color: 'text-yellow-400 bg-yellow-500/20', icon: Clock },
    APPROVED: { label: 'تم التعميد', color: 'text-blue-400 bg-blue-500/20', icon: Check },
    REJECTED: { label: 'مرفوض', color: 'text-red-400 bg-red-500/20', icon: X },
    PURCHASING: { label: 'جاري الشراء', color: 'text-purple-400 bg-purple-500/20', icon: ShoppingCart },
    PURCHASED: { label: 'تم الشراء', color: 'text-cyan-400 bg-cyan-500/20', icon: Package },
    DELIVERED: { label: 'تم التسليم', color: 'text-orange-400 bg-orange-500/20', icon: Truck },
    RECEIVED: { label: 'تم الاستلام', color: 'text-green-400 bg-green-500/20', icon: CheckCircle },
    COMPLETED: { label: 'مكتمل', color: 'text-green-400 bg-green-500/20', icon: CheckCircle }
};

const DEPARTMENT_NAMES: Record<string, string> = {
    reception: 'الاستقبال',
    bellman: 'البيلمان',
    housekeeping: 'الهاوس كيبنج',
    maintenance: 'الصيانة',
    dashboard: 'الإدارة'
};

type TabType = 'new' | 'in_progress' | 'completed';

// ============================================================
// STAT CARD - MOVED TO: components/common/StatCard.tsx
// Using centralized version for consistency (supports both 'color' and 'bgColor' props)

// ============================================================
// REQUEST CARD
// ============================================================

// ✅ COMPACT Procurement Request Card - Mobile-First
const RequestCard: React.FC<{
    request: ProcurementRequest;
    onApprove?: () => void;
    onReject?: () => void;
    onStartPurchase?: () => void;
    onComplete?: () => void;
    isManager: boolean;
    isRep: boolean;
    currentUserId?: string;
}> = ({ request, onApprove, onReject, onStartPurchase, onComplete, isManager, isRep, currentUserId }) => {
    const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING_APPROVAL;
    const StatusIcon = status.icon;
    const isUrgent = request.items.some(i => i.priority === 'urgent');

    const timeAgo = (() => {
        if (!request.createdAt) return '';
        const date = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return 'الآن';
        if (diff < 60) return `${diff}د`;
        if (diff < 1440) return `${Math.floor(diff / 60)}س`;
        return `${Math.floor(diff / 1440)}ي`;
    })();

    return (
        <div className={`p-3 rounded-xl adora-card border shadow-sm hover:scale-[1.01] transition-all
            ${isUrgent ? 'border-red-500/50 ring-1 ring-red-500/30' : 'adora-border'}`}>
            
            {/* Row 1: Department + Requester + Status */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-indigo-500/20 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium adora-text-primary truncate">{DEPARTMENT_NAMES[request.department]}</span>
                        {isUrgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    </div>
                    <p className="text-[10px] adora-text-tertiary truncate">{request.requestedBy.name}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        <span>{status.label}</span>
                    </div>
                    <span className="text-[10px] adora-text-disabled">{timeAgo}</span>
                </div>
            </div>

            {/* Row 2: Items Summary */}
            <div className="text-[10px] adora-text-secondary mb-2 px-2 py-1 rounded adora-bg-tertiary">
                <span className="font-medium">{request.items.length} عناصر:</span> {request.items.slice(0, 2).map(i => `${i.itemName} (${i.quantity})`).join(' • ')}
                {request.items.length > 2 && ` +${request.items.length - 2}`}
            </div>

            {/* Row 3: Actions */}
            <div className="flex gap-2 pt-2 border-t adora-border">
                {isManager && request.status === 'PENDING_APPROVAL' && request.requestedBy.id !== currentUserId && (
                    <>
                        <button onClick={onApprove} className="flex-1 py-1.5 px-2 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> تعميد
                        </button>
                        <button onClick={onReject} className="py-1.5 px-2 rounded-lg bg-red-500/20 text-red-500 text-xs font-bold" title="رفض">
                            <X className="w-3 h-3" />
                        </button>
                    </>
                )}
                {isManager && request.status === 'PENDING_APPROVAL' && request.requestedBy.id === currentUserId && (
                    <div className="flex-1 text-center text-[10px] adora-text-secondary py-1.5">بانتظار تعميد</div>
                )}
                {isRep && request.status === 'APPROVED' && (
                    <button onClick={onStartPurchase} className="flex-1 py-1.5 px-2 rounded-lg bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> شراء
                    </button>
                )}
                {isRep && request.status === 'PURCHASING' && (
                    <button onClick={onComplete} className="flex-1 py-1.5 px-2 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                        <Package className="w-3 h-3" /> تم
                    </button>
                )}
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ProcurementDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { success, error, haptic, playSound } = useUX();
    const brandName = useBrandName();
    
    // ✅ Feature Gate: Check if procurement system is enabled
    const { isEnabled: isProcurementEnabled } = useFeatureGate('procurementSystem');
    
    const [requests, setRequests] = useState<ProcurementRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState<TabType>('new');
    const [showHistory, setShowHistory] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    
    // ✅ FAST UI: Force show page after 2 seconds max
    useEffect(() => {
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                console.log('⚡ Fast UI: Showing Procurement page now');
                setLoading(false);
            }
        }, 2000);
        return () => clearTimeout(fastUITimeout);
    }, [loading]);
    
    // ✅ Points Notification State
    const [activeNotifications, setActiveNotifications] = useState<Set<string>>(new Set());
    const [notificationRequest, setNotificationRequest] = useState<ProcurementRequest | null>(null);
    
    // ✅ Branch Location Warning State
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    const [locationWarningData, setLocationWarningData] = useState<any>(null);
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('procurement');
    
    // ✅ General Instructions State
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false);
    
    // ✅ Purchase Complete Modal State
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<ProcurementRequest | null>(null);

    // Voice Agent Integration
    const {
        isActive,
        status: agentStatus,
        transcript,
        feedback,
        cancel,
        processCommand,
        // 🛡️ Error Recovery
        errorCount,
        isFallbackMode,
        lastError,
        retryLastCommand,
        resetErrors
    } = useSmartAgent({
        context: 'procurement',
        schema: {
            action: "CREATE_PROCUREMENT_REQUEST",
            description: "Create a new procurement request",
            properties: {
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            itemName: { type: "string" },
                            quantity: { type: "number" },
                            unit: { type: "string" },
                            urgency: { type: "string", enum: ["low", "medium", "high"] }
                        }
                    }
                }
            },
            required: ["items"]
        },
        // We can pass dynamic data (e.g., inventory item names) here later
        data: {
            recentRequests: requests.slice(0, 5).map(r => r.items.map(i => i.itemName).join(', '))
        },
        onSuccess: (action, params) => {
            if (action === 'CREATE_PROCUREMENT_REQUEST') {
                // The hook handles the creation via 'CREATE_PROCUREMENT_REQUEST' atomic action we added.
                // We just refresh or show success here if needed, but the hook does playSound.
                success(`تم إنشاء طلب شراء: ${params.items.length} عناصر`);
            }
        }
    });

    // Determine role
    // ✅ FIX: Strict role checking based on user profile
    const isManager = ['manager', 'owner', 'admin'].includes(user?.role || '');
    const isRep = ['procurement', 'manager', 'owner', 'admin'].includes(user?.role || '');

    // ✅ FIX: Use branchId from AuthContext (updates when manager switches branches)
    const { branchId: authBranchId } = useAuth();
    const branchId = authBranchId || (user as any)?.branchId || (user as any)?.branch;

    // ✅ SaaS: Get tenantId from auth context
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

    // Load data with fallback for missing index
    useEffect(() => {
        if (!user || !tenantId) return;
        
        // ✅ FIX: Manager/Owner sees ALL branches if no specific branch selected
        // Regular employees only see their branch
        const shouldFilterByBranch = !isManager || (isManager && branchId);

        const requestsRef = collection(db, 'procurementRequests');
        let unsubscribe: (() => void) | null = null;
        let fallbackAttempted = false;

        // ✅ SaaS: Add tenantId filter for proper isolation
        // Try with orderBy first, fallback to simple query if index not ready
        const trySubscribe = (useOrderBy: boolean) => {
            const constraints: any[] = [
                where('tenantId', '==', tenantId) // ✅ SaaS requirement - mandatory filter
            ];
            
            // ✅ Only filter by branch if not a manager viewing all, or if specific branch is selected
            if (shouldFilterByBranch && branchId) {
                constraints.push(where('branch', '==', branchId));
            }
            
            if (useOrderBy) {
                constraints.push(orderBy('createdAt', 'desc'));
            }
            
            const q = query(requestsRef, ...constraints);

            return onSnapshot(q,
                (snapshot) => {
                    let loadedRequests: ProcurementRequest[] = [];
                    snapshot.forEach(doc => {
                        loadedRequests.push({ id: doc.id, ...doc.data() } as ProcurementRequest);
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
                },
                (error: any) => {
                    console.error('Query error:', error);
                    // If index error, try without orderBy (only once)
                    if (useOrderBy && error.code === 'failed-precondition' && !fallbackAttempted) {
                        console.warn('Index not ready, using fallback query without orderBy');
                        fallbackAttempted = true;
                        // Unsubscribe from current query before trying fallback
                        if (unsubscribe) {
                            unsubscribe();
                        }
                        // Try without orderBy
                        unsubscribe = trySubscribe(false);
                    } else {
                        setLoading(false);
                    }
                }
            );
        };

        unsubscribe = trySubscribe(true);
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [user, branchId, tenantId]);

    // ✅ Grouped requests - Unified Tab System
    const groupedRequests = {
        new: requests.filter(r => r.status === 'PENDING_APPROVAL'),
        in_progress: requests.filter(r => ['APPROVED', 'PURCHASING', 'PURCHASED', 'DELIVERED'].includes(r.status)),
        completed: requests.filter(r => ['RECEIVED', 'COMPLETED'].includes(r.status))
    };

    // Backward compatibility aliases
    const pendingApproval = groupedRequests.new;
    const approved = groupedRequests.in_progress;
    const completed = groupedRequests.completed;

    // Current list based on selected tab
    const currentRequests = groupedRequests[currentTab];

    // ✅ Show Points Notification for new APPROVED or PENDING_APPROVAL requests
    useEffect(() => {
        // For managers: Show PENDING_APPROVAL notifications
        // For reps: Show APPROVED notifications (ready to purchase)
        const isManager = user?.role === 'manager' || user?.role === 'owner';
        const isRep = user?.role === 'employee' && user?.department === 'procurement';
        
        const targetStatus = isManager ? 'PENDING_APPROVAL' : 'APPROVED';
        const firstPending = requests.find(
            req => req.status === targetStatus && !activeNotifications.has(req.id)
        );

        if (firstPending && tenantId) {
            setActiveNotifications(prev => new Set(prev).add(firstPending.id));
            setNotificationRequest(firstPending);
            
            const timer = setTimeout(() => {
                setNotificationRequest(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [requests, activeNotifications, tenantId, user?.role, user?.department]);

    // Actions
    const handleApprove = async (id: string) => {
        try {
            await approveProcurement(id, user?.id || '', user?.name || '', tenantId);
            success('تم التعميد بنجاح');
        } catch (err) {
            console.error('Error approving:', err);
            error('فشل التعميد');
        }
    };

    const handleReject = async (id: string) => {
        try {
            await rejectProcurement(id, user?.id || '', user?.name || '', 'مرفوض من المدير', tenantId);
            haptic('medium');
        } catch (error) {
            console.error('Error rejecting:', error);
            haptic('error');
        }
    };

    const handleStartPurchase = async (id: string) => {
        try {
            await startPurchasing(id, user?.id || '', user?.name || '');
            haptic('success');

            // ✅ Auto-check daily attendance when employee starts purchasing
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
        } catch (error) {
            console.error('Error starting purchase:', error);
            haptic('error');
        }
    };

    // ✅ فتح نافذة تسجيل الشراء (بدلاً من الشراء المباشر)
    const handleOpenPurchaseModal = (request: ProcurementRequest) => {
        setSelectedRequest(request);
        setShowPurchaseModal(true);
    };

    // ✅ تنفيذ الشراء بعد تحديد الكميات من النافذة
    const handleCompletePurchase = async (
        items: { itemName: string; purchasedQty: number; unitPrice?: number }[],
        totalCost: number,
        notes?: string
    ) => {
        if (!selectedRequest) return;
        
        try {
            // 1. تسجيل الشراء مع الكميات المحددة
            const newRequestId = await completePurchase(selectedRequest.id, items, totalCost, notes);

            // 2. تسليم للقسم الطالب (DELIVERED)
            await deliverItems(selectedRequest.id, user?.id || '', user?.name || '', tenantId);

            // 3. التحقق من الشراء الجزئي
            const hasPartial = items.some((item, index) => {
                const originalItem = selectedRequest.items[index];
                return item.purchasedQty < originalItem.quantity;
            });

            if (hasPartial && newRequestId) {
                success('تم الشراء الجزئي وإنشاء طلب جديد للكمية المتبقية');
            } else {
                success('تم إكمال الشراء وإرساله للقسم الطالب');
            }

            // ✅ Auto-check daily attendance
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

            haptic('success');
        } catch (err) {
            console.error('Error completing purchase:', err);
            error('فشل إكمال الشراء');
            haptic('error');
        }
    };
    
    // ✅ Hide component if feature is disabled - AFTER all hooks
    if (!isProcurementEnabled) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--theme-gradient-page)' }}>
                <div 
                    className="p-12 text-center max-w-md rounded-2xl shadow-lg"
                    style={{ 
                        background: 'var(--theme-bg-secondary)', 
                        border: '1px solid var(--theme-border-primary)',
                    }}
                >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--theme-bg-tertiary)' }}>
                        <AlertCircle className="w-8 h-8" style={{ color: 'var(--theme-text-tertiary)' }} />
                    </div>
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>نظام المشتريات غير مفعل</h2>
                    <p style={{ color: 'var(--theme-text-secondary)' }}>يرجى التواصل مع المالك لتفعيل هذه الميزة</p>
                </div>
            </div>
        );
    }

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
            <ManagerAnnouncementBanner department="procurement" />
            
            <div className="min-h-screen p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6 pb-16 sm:pb-20 md:pb-24 overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                {/* Flexible Header */}
                <FlexibleHeader
                title="المشتريات"
                titleIcon={<ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 flex-shrink-0" />}
                showGreeting={false}
                brandName={brandName}
                subtitle={undefined}
                actions={[
                    {
                        id: 'general-instructions',
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
                        id: 'logout',
                        icon: <LogOut className="w-5 h-5" />,
                        label: 'تسجيل خروج',
                        onClick: logout,
                        variant: 'danger'
                    }
                ]}
            />

            {/* 🎤 Smart Voice FAB (No Overlay) - Verified Fix */}
            <VoiceInputButton
                onResult={processCommand}
                isFallbackMode={isFallbackMode}
                errorCount={errorCount}
                lastError={lastError}
                onRetry={retryLastCommand}
                onResetErrors={resetErrors}
            />

            {/* Stats - ✅ Moved BEFORE Challenge Timeline to prevent hiding - Mobile-First */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <StatCard
                    count={pendingApproval.length}
                    label="⏳ بانتظار التعميد"
                    icon={Clock}
                    iconColor="orange"
                    status={pendingApproval.length > 10 ? 'warning' : 'normal'}
                    lastUpdate="تم التحديث الآن"
                />
                <StatCard
                    count={approved.length}
                    label="🛒 قيد الشراء"
                    icon={ShoppingCart}
                    iconColor="purple"
                    status="normal"
                    lastUpdate="تم التحديث الآن"
                />
                <StatCard
                    count={completed.length}
                    label="✅ مكتمل"
                    icon={CheckCircle}
                    iconColor="green"
                    status="success"
                    lastUpdate="تم التحديث الآن"
                />
                </div>
            </div>

            {/* ✅ Challenge Timeline - شريط الالتزام */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <ChallengeTimeline />
            </div>

            {/* Golden Alert - Broadcast Messages */}
            <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                <GoldenAlertDisplay department="procurement" />
            </div>

            {/* ✅ Points Notification - Show for active APPROVED or PENDING_APPROVAL requests */}
            {notificationRequest && tenantId && (
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <PointsNotification
                        requestId={notificationRequest.id}
                        requestType="procurement"
                        department="procurement"
                        createdAt={notificationRequest.createdAt}
                        tenantId={tenantId}
                        onDismiss={() => setNotificationRequest(null)}
                    />
                </div>
            )}

            {/* ✅ Unified Tabs - Same as Reception */}
            <UnifiedRequestTabs
                currentTab={currentTab}
                onTabChange={(tab) => setCurrentTab(tab)}
                newCount={groupedRequests.new.length}
                inProgressCount={groupedRequests.in_progress.length}
                completedCount={groupedRequests.completed.length}
            />

            {/* Requests List - Grid for Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {currentRequests.length === 0 ? (
                    <div 
                        className="p-12 text-center rounded-2xl shadow-lg"
                        style={{ 
                            background: 'var(--theme-bg-secondary)', 
                            border: '1px solid var(--theme-border-primary)',
                        }}
                    >
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--theme-bg-tertiary)' }}>
                            <Package className="w-8 h-8" style={{ color: 'var(--theme-text-tertiary)' }} />
                        </div>
                        <p style={{ color: 'var(--theme-text-secondary)' }}>لا توجد طلبات</p>
                    </div>
                ) : (
                    currentRequests.map(request => (
                        <RequestCard
                            key={request.id}
                            request={request}
                            isManager={isManager}
                            isRep={isRep}
                            currentUserId={user?.id}
                            onApprove={() => handleApprove(request.id)}
                            onReject={() => handleReject(request.id)}
                            onStartPurchase={() => handleStartPurchase(request.id)}
                            onComplete={() => handleOpenPurchaseModal(request)}
                        />
                    ))
                )}
            </div>



            {/* History Modal */}
            <UnifiedHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} defaultDepartment="procurement" />

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
                        icon: <span className="text-lg">📋</span>,
                        onClick: () => setShowHistory(true),
                        color: 'text-blue-400'
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
                department="procurement"
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

            {/* ✅ Purchase Complete Modal - نافذة تسجيل الشراء */}
            {selectedRequest && (
                <PurchaseCompleteModal
                    isOpen={showPurchaseModal}
                    onClose={() => {
                        setShowPurchaseModal(false);
                        setSelectedRequest(null);
                    }}
                    request={selectedRequest}
                    onComplete={handleCompletePurchase}
                />
            )}

            {/* 📝 Developer Signature */}
            {/* Developer Signature is in GlobalFooter (App.tsx) */}
            </div>
        </PageTransition>
    );
};

export default ProcurementDashboard;
