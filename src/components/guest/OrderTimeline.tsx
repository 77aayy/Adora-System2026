/**
 * Order Timeline Component
 * Real-time order tracking for guests via QR page
 * 
 * ✅ Features:
 * - Progress bar showing order stages
 * - Real-time Firebase listeners
 * - Arabic status messages
 * - Rating prompt on completion
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    CheckCircle, Clock, User, Package, Truck, Star,
    ChevronDown, ChevronUp, Bell, Sparkles, Coffee, Wrench
} from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface TimelineStage {
    key: string;
    label: string;
    labelEn: string;
    icon: React.ReactNode;
    description: string;
}

interface OrderTimelineProps {
    requestId: string;
    tenantId: string;
    branchId: string;
    requestType: string;
    onRateRequest?: () => void;
}

// ============================================================
// STAGE DEFINITIONS
// ============================================================

const ORDER_STAGES: TimelineStage[] = [
    {
        key: 'sent',
        label: 'تم إرسال الطلب',
        labelEn: 'Request Sent',
        icon: <Bell className="w-4 h-4" />,
        description: 'طلبك قيد الانتظار للمراجعة'
    },
    {
        key: 'received',
        label: 'تم استلام الطلب',
        labelEn: 'Request Received',
        icon: <CheckCircle className="w-4 h-4" />,
        description: 'تم استلام طلبك من قبل الاستقبال'
    },
    {
        key: 'assigned',
        label: 'جاري التوجيه للقسم',
        labelEn: 'Being Assigned',
        icon: <User className="w-4 h-4" />,
        description: 'يتم تحويل طلبك للقسم المختص'
    },
    {
        key: 'in_progress',
        label: 'جاري التنفيذ',
        labelEn: 'In Progress',
        icon: <Sparkles className="w-4 h-4" />,
        description: 'العامل يعمل على طلبك الآن'
    },
    {
        key: 'completing',
        label: 'جاري التأكيد',
        labelEn: 'Completing',
        icon: <Package className="w-4 h-4" />,
        description: 'تم الانتهاء، جاري تأكيد الجودة'
    },
    {
        key: 'completed',
        label: 'تم بنجاح',
        labelEn: 'Completed',
        icon: <Star className="w-4 h-4" />,
        description: 'تم إنجاز طلبك بنجاح!'
    }
];

// Status to stage mapping
const STATUS_TO_STAGE: Record<string, number> = {
    'pending': 0,
    'new': 0,
    'confirmed': 1,
    'received': 1,
    'accepted': 2,
    'assigned': 2,
    'in_progress': 3,
    'cleaning': 3,
    'preparing': 3,
    'on_the_way': 3,
    'working': 3,
    'completing': 4,
    'inspection': 4,
    'quality_check': 4,
    'completed': 5,
    'done': 5,
    'closed': 5
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getServiceIcon = (type: string) => {
    switch (type) {
        case 'cleaning':
        case 'housekeeping':
            return <Sparkles className="w-5 h-5" />;
        case 'maintenance':
            return <Wrench className="w-5 h-5" />;
        case 'coffee':
        case 'coffeeShop':
            return <Coffee className="w-5 h-5" />;
        default:
            return <Bell className="w-5 h-5" />;
    }
};

const getServiceColor = (type: string) => {
    switch (type) {
        case 'cleaning':
        case 'housekeeping':
            return 'teal';
        case 'maintenance':
            return 'amber';
        case 'coffee':
        case 'coffeeShop':
            return 'orange';
        default:
            return 'blue';
    }
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const OrderTimeline: React.FC<OrderTimelineProps> = ({
    requestId,
    tenantId,
    branchId,
    requestType,
    onRateRequest
}) => {
    const [currentStage, setCurrentStage] = useState(0);
    const [requestData, setRequestData] = useState<any>(null);
    const [expanded, setExpanded] = useState(true);
    const [loading, setLoading] = useState(true);
    const [showRating, setShowRating] = useState(false);

    const color = getServiceColor(requestType);

    // Real-time listener for request status
    useEffect(() => {
        if (!requestId || !tenantId || !branchId) return;

        const requestRef = doc(db, `tenants/${tenantId}/branches/${branchId}/requests/${requestId}`);

        const unsubscribe = onSnapshot(requestRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setRequestData(data);

                // Map status to stage
                const status = data.status?.toLowerCase() || 'pending';
                const stage = STATUS_TO_STAGE[status] ?? 0;
                setCurrentStage(stage);

                // Show rating prompt on completion
                if (stage === 5 && !data.rating) {
                    setShowRating(true);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [requestId, tenantId, branchId]);

    if (loading) {
        return (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-center gap-2 py-4">
                    <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-white/60 text-sm">جاري تحميل حالة الطلب...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl overflow-hidden border transition-all ${
            currentStage === 5 
                ? 'bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/30' 
                : 'bg-white/5 border-white/10'
        }`}>
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-${color}-500/20 flex items-center justify-center text-${color}-400`}>
                        {getServiceIcon(requestType)}
                    </div>
                    <div className="text-right">
                        <p className="text-white font-bold text-sm">
                            {ORDER_STAGES[currentStage]?.label || 'جاري المعالجة'}
                        </p>
                        <p className="text-white/50 text-xs">
                            {ORDER_STAGES[currentStage]?.description}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Progress percentage */}
                    <span className={`text-${color}-400 font-bold text-sm`}>
                        {Math.round((currentStage / (ORDER_STAGES.length - 1)) * 100)}%
                    </span>
                    {expanded ? (
                        <ChevronUp className="w-5 h-5 text-white/40" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-white/40" />
                    )}
                </div>
            </button>

            {/* Progress Bar */}
            <div className="px-4 pb-2">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className={`h-full bg-gradient-to-r from-${color}-500 to-${color}-400 rounded-full transition-all duration-700`}
                        style={{ width: `${(currentStage / (ORDER_STAGES.length - 1)) * 100}%` }}
                    />
                </div>
            </div>

            {/* Expanded Timeline */}
            {expanded && (
                <div className="px-4 pb-4 animate-fadeIn">
                    <div className="relative pr-6 space-y-0">
                        {ORDER_STAGES.map((stage, index) => {
                            const isComplete = index < currentStage;
                            const isCurrent = index === currentStage;
                            const isPending = index > currentStage;

                            return (
                                <div key={stage.key} className="relative flex items-start gap-3 py-3">
                                    {/* Vertical Line */}
                                    {index < ORDER_STAGES.length - 1 && (
                                        <div
                                            className={`absolute right-[11px] top-10 w-0.5 h-[calc(100%-16px)] ${
                                                isComplete ? `bg-${color}-500` : 'bg-white/10'
                                            }`}
                                        />
                                    )}

                                    {/* Circle/Icon */}
                                    <div
                                        className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                                            isComplete
                                                ? `bg-${color}-500 text-white`
                                                : isCurrent
                                                    ? `bg-${color}-500/30 text-${color}-400 ring-4 ring-${color}-500/20 animate-pulse`
                                                    : 'bg-white/10 text-white/30'
                                        }`}
                                    >
                                        {isComplete ? (
                                            <CheckCircle className="w-4 h-4" />
                                        ) : (
                                            <span className="text-xs font-bold">{index + 1}</span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={`flex-1 ${isPending ? 'opacity-40' : ''}`}>
                                        <p className={`font-bold text-sm ${
                                            isCurrent ? `text-${color}-400` : 'text-white'
                                        }`}>
                                            {stage.label}
                                        </p>
                                        <p className="text-white/50 text-xs mt-0.5">
                                            {stage.description}
                                        </p>
                                        
                                        {/* Timestamp if available */}
                                        {requestData?.timeline?.[stage.key] && (
                                            <p className="text-white/30 text-[10px] mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(requestData.timeline[stage.key]?.toDate?.() || requestData.timeline[stage.key]).toLocaleTimeString('ar-SA', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        )}
                                    </div>

                                    {/* Status Badge */}
                                    {isCurrent && (
                                        <div className={`px-2 py-1 rounded-full bg-${color}-500/20 text-${color}-400 text-[10px] font-bold animate-pulse`}>
                                            الآن
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Rating Prompt */}
                    {showRating && (
                        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 animate-bounce-gentle">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                        <Star className="w-5 h-5 text-yellow-400" />
                                    </div>
                                    <div>
                                        <p className="text-yellow-400 font-bold text-sm">كيف كانت الخدمة؟</p>
                                        <p className="text-yellow-400/60 text-xs">تقييمك يساعدنا على التحسين</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowRating(false);
                                        onRateRequest?.();
                                    }}
                                    className="px-4 py-2 bg-yellow-500 text-black font-bold text-sm rounded-xl hover:bg-yellow-400 transition-colors"
                                >
                                    قيّم الآن
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================
// MINI VERSION (For Header Notification)
// ============================================================

interface OrderTimelineMiniProps {
    requests: Array<{
        id: string;
        status: string;
        type: string;
    }>;
    onViewAll?: () => void;
}

export const OrderTimelineMini: React.FC<OrderTimelineMiniProps> = ({
    requests,
    onViewAll
}) => {
    const activeRequests = requests.filter(r => 
        !['completed', 'done', 'closed', 'cancelled'].includes(r.status?.toLowerCase())
    );

    if (activeRequests.length === 0) return null;

    return (
        <button
            onClick={onViewAll}
            className="relative flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/20 border border-teal-500/30 hover:bg-teal-500/30 transition-colors"
        >
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-teal-400 text-sm font-bold">
                {activeRequests.length} طلب نشط
            </span>
            <Bell className="w-4 h-4 text-teal-400" />
            
            {/* Notification Badge */}
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeRequests.length}
            </div>
        </button>
    );
};

export default OrderTimeline;
