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

type TabType = 'pending' | 'approved' | 'all';

// ============================================================
// STAT CARD - MOVED TO: components/common/StatCard.tsx
// Using centralized version for consistency (supports both 'color' and 'bgColor' props)

// ============================================================
// REQUEST CARD
// ============================================================

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

    const timeAgo = (() => {
        if (!request.createdAt) return '';
        const date = request.createdAt.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return 'الآن';
        if (diff < 60) return `${diff} د`;
        if (diff < 1440) return `${Math.floor(diff / 60)} س`;
        return `${Math.floor(diff / 1440)} ي`;
    })();

    return (
        <div 
            className="p-3 sm:p-4 hover:scale-[1.02] active:scale-[0.98] transition-all touch-manipulation rounded-2xl shadow-lg"
            style={{ 
                background: 'var(--theme-bg-secondary)', 
                border: '1px solid var(--theme-border-primary)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <p className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{DEPARTMENT_NAMES[request.department]}</p>
                        <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{request.requestedBy.name}</p>
                    </div>
                </div>
                <div className="text-left">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${status.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-xs">{status.label}</span>
                    </div>
                    <p className="text-xs mt-1 text-center" style={{ color: 'var(--theme-text-tertiary)' }}>{timeAgo}</p>
                </div>
            </div>

            {/* Items */}
            <div className="mb-3 rounded-xl p-3" style={{ background: 'var(--theme-bg-tertiary)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--theme-text-secondary)' }}>العناصر ({request.items.length})</p>
                <div className="space-y-1">
                    {request.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span style={{ color: 'var(--theme-text-primary)' }}>{item.itemName}</span>
                            <span style={{ color: 'var(--theme-text-secondary)' }}>{item.quantity}</span>
                        </div>
                    ))}
                    {request.items.length > 3 && (
                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>+{request.items.length - 3} عناصر أخرى</p>
                    )}
                </div>
            </div>

            {/* Priority Badge */}
            {request.items.some(i => i.priority === 'urgent') && (
                <div className="mb-3 px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs inline-block">
                    ⚡ يحتوي على عناصر عاجلة
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                {isManager && request.status === 'PENDING_APPROVAL' && request.requestedBy.id !== currentUserId && (
                    <>
                        <button
                            onClick={onApprove}
                            className="adora-btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            تعميد
                        </button>
                        <button
                            onClick={onReject}
                            className="adora-btn-danger py-3 px-4"
                            title="رفض الطلب"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </>
                )}
                {/* ℹ️ Show message if self-approval is blocked */}
                {isManager && request.status === 'PENDING_APPROVAL' && request.requestedBy.id === currentUserId && (
                    <div className="adora-info-box teal flex-1 justify-center text-xs">
                        بانتظار تعميد من مدير آخر
                    </div>
                )}
                {isRep && request.status === 'APPROVED' && (
                    <button
                        onClick={onStartPurchase}
                        className="adora-btn flex-1 py-3 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(to right, #a855f7, #6366f1)', color: 'white' }}
                    >
                        <ShoppingCart className="w-5 h-5" />
                        بدء الشراء
                    </button>
                )}
                {isRep && request.status === 'PURCHASING' && (
                    <button
                        onClick={onComplete}
                        className="adora-btn flex-1 py-3 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(to right, #06b6d4, #3b82f6)', color: 'white' }}
                    >
                        <Package className="w-5 h-5" />
                        تم الشراء
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
    const [currentTab, setCurrentTab] = useState<TabType>('pending');
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

    // Grouped requests
    const pendingApproval = requests.filter(r => r.status === 'PENDING_APPROVAL');
    const approved = requests.filter(r => ['APPROVED', 'PURCHASING', 'PURCHASED'].includes(r.status));
    const completed = requests.filter(r => ['RECEIVED', 'COMPLETED'].includes(r.status));

    // Current list
    const currentRequests = currentTab === 'pending' ? pendingApproval :
        currentTab === 'approved' ? approved : requests;

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

    const handleComplete = async (request: ProcurementRequest) => {
        try {
            // For demo - mark all as purchased with full quantity
            const items = request.items.map(item => ({
                itemName: item.itemName,
                purchasedQty: item.quantity,
                unitPrice: 0
            }));
            await completePurchase(request.id, items, 0);

            // Also mark as delivered
            await deliverItems(request.id, user?.id || '', user?.name || '');

            success('تم إكمال الشراء والتسليم');
        } catch (err) {
            console.error('Error completing:', err);
            error('فشل إكمال الشراء');
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
                showGreeting={true}
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

            {/* ✅ Challenge Timeline - شريط الالتزام */}
            <ChallengeTimeline />

            {/* Golden Alert - Broadcast Messages */}
            <GoldenAlertDisplay department="procurement" />

            {/* ✅ Points Notification - Show for active APPROVED or PENDING_APPROVAL requests */}
            {notificationRequest && tenantId && (
                <PointsNotification
                    requestId={notificationRequest.id}
                    requestType="procurement"
                    department="procurement"
                    createdAt={notificationRequest.createdAt}
                    tenantId={tenantId}
                    onDismiss={() => setNotificationRequest(null)}
                />
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
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

            {/* Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto">
                {[
                    { key: 'pending', label: 'بانتظار التعميد', count: pendingApproval.length },
                    { key: 'approved', label: 'قيد التنفيذ', count: approved.length },
                    { key: 'all', label: 'الكل', count: requests.length }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setCurrentTab(tab.key as TabType)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${currentTab === tab.key
                            ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-lg'
                            : ''
                            }`}
                        style={currentTab !== tab.key ? { 
                            background: 'var(--theme-bg-tertiary)', 
                            color: 'var(--theme-text-secondary)',
                        } : {}}
                    >
                        {tab.label}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${currentTab === tab.key ? 'bg-white/20' : ''}`}
                            style={currentTab !== tab.key ? { background: 'var(--theme-bg-secondary)' } : {}}
                        >
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Requests List */}
            <div className="space-y-3">
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
                            onComplete={() => handleComplete(request)}
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

            {/* 📝 Developer Signature */}
            {/* Developer Signature is in GlobalFooter (App.tsx) */}
            </div>
        </PageTransition>
    );
};

export default ProcurementDashboard;
