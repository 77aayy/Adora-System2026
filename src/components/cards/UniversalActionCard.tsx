/**
 * 🎯 Universal Action Card - The Hero Card
 * الكارت الموحد الشامل - "البطل" في أدورا
 * 
 * Features:
 * - Dynamic Progress Bar (The Pulse) with color stages
 * - QR Data Fields (ID, Mobile for identity verification)
 * - Journey History (Previous Action, Next Step)
 * - Points Integration (Real-time calculation)
 * - Reception Alert (Turquoise border when action required)
 * - State Machine Integration (NEW → IN_PROGRESS → COMPLETED)
 * 
 * @version 1.0.0 - Phase 1: Unified State Machine + Pulse Progress Bar
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Clock, CheckCircle, PlayCircle, XCircle, Wrench, User, DoorOpen,
    Sparkles, BellRing, Package, ShoppingCart, Users, PauseCircle,
    Calendar, AlertTriangle, QrCode, Phone, CreditCard, ArrowRight,
    TrendingUp, TrendingDown, Info, History, Target
} from 'lucide-react';
import { Request, RequestStatus } from '../../types/request';
import { Timestamp } from 'firebase/firestore';
import { getPointsConfig } from '../../services/pointsService';
import { useAuth } from '../../context/AuthContext';
import { DepartmentId, DEPARTMENTS, REQUEST_TYPE_TO_DEPARTMENT } from '../../services/workflowService';
import { extractUnifiedStatus } from '../../services/stateTransitionService';

// ============================================================
// TYPES
// ============================================================

type ViewMode = 'guest' | 'reception' | 'housekeeping' | 'maintenance' | 'bellman' | 'procurement';

interface UniversalActionCardProps {
    request: Request | any; // Support both Request and legacy formats (CleaningRequest, etc.)
    viewMode: ViewMode;
    onAction?: (action: string) => void;
    onView?: () => void;
    className?: string;
}

interface ProgressState {
    percentage: number; // 0-100
    stage: 'safe' | 'warning' | 'critical'; // Green | Yellow | Red
    remainingMinutes: number;
    isOverdue: boolean;
    pointsAtRisk: number;
    pointsReward: number;
}

interface JourneyInfo {
    previousAction?: string;
    previousDepartment?: string;
    nextStep?: string;
    nextDepartment?: string;
    journeySummary: string;
}

// ============================================================
// COMPONENT
// ============================================================

export const UniversalActionCard: React.FC<UniversalActionCardProps> = ({
    request,
    viewMode,
    onAction,
    onView,
    className = ''
}) => {
    const { t } = useTranslation();
    const { tenantId } = useAuth();
    
    // State
    const [progressState, setProgressState] = useState<ProgressState>({
        percentage: 0,
        stage: 'safe',
        remainingMinutes: 0,
        isOverdue: false,
        pointsAtRisk: 0,
        pointsReward: 0
    });
    const [pointsConfig, setPointsConfig] = useState<any>(null);
    const [loadingConfig, setLoadingConfig] = useState(true);
    
    // ✅ Normalize request to handle both Request and legacy formats
    const normalizedRequest = useMemo(() => {
        return {
            ...request,
            roomNumber: request.roomNumber || request.room || '',
            guestName: request.guestName || request.guest?.name || '',
            guestIdentity: request.guestIdentity || request.guest?.identity || '',
            guestPhone: request.guestPhone || request.guest?.phone || '',
            type: request.type || 'cleaning',
            status: request.status || 'NEW',
            createdAt: request.createdAt || request.timestamp,
            currentDepartment: request.currentDepartment || request.department,
            stateHistory: request.stateHistory || request.workflow?.journey || [],
            involvedDepartments: request.involvedDepartments || [],
            source: request.source || 'reception',
            priority: request.priority || 'normal',
            notes: request.notes || '',
            isActionRequiredByReception: request.isActionRequiredByReception || false,
            targetCompletionTime: request.targetCompletionTime
        };
    }, [request]);
    
    // Extract unified status
    const unifiedStatus = useMemo(() => extractUnifiedStatus(request), [request]);
    
    // Check if reception action is required
    const isActionRequiredByReception = normalizedRequest.isActionRequiredByReception || false;
    
    // Get journey info
    const journeyInfo = useMemo<JourneyInfo>(() => {
        const history = normalizedRequest.stateHistory || normalizedRequest.workflow?.journey || [];
        const involvedDepts = normalizedRequest.involvedDepartments || [];
        
        if (history.length === 0) {
            return {
                journeySummary: 'طلب جديد'
            };
        }
        
        const lastEntry = history[history.length - 1];
        const previousEntry = history.length > 1 ? history[history.length - 2] : null;
        
        // Determine next step based on current state
        let nextStep = '';
        let nextDepartment = '';
        
        if (unifiedStatus === 'NEW' && normalizedRequest.currentDepartment) {
            nextStep = 'بدء العمل';
            nextDepartment = normalizedRequest.currentDepartment;
        } else if (unifiedStatus === 'IN_PROGRESS') {
            nextStep = 'إكمال العمل';
            nextDepartment = normalizedRequest.currentDepartment || '';
        } else if (unifiedStatus === 'COMPLETED') {
            nextStep = 'إقفال الطلب';
            nextDepartment = 'reception';
        }
        
        return {
            previousAction: previousEntry?.notes || lastEntry?.notes || 'تم الإنشاء',
            previousDepartment: previousEntry?.fromDepartment || lastEntry?.fromDepartment,
            nextStep,
            nextDepartment,
            journeySummary: `${involvedDepts.length} قسم مشارك`
        };
    }, [normalizedRequest, unifiedStatus]);
    
    // Load points config
    useEffect(() => {
        if (!tenantId) return;
        
        getPointsConfig(tenantId)
            .then(config => {
                setPointsConfig(config);
                setLoadingConfig(false);
            })
            .catch(err => {
                console.error('Failed to load points config:', err);
                setLoadingConfig(false);
            });
    }, [tenantId]);
    
    // Calculate progress bar state
    useEffect(() => {
        if (!normalizedRequest.createdAt || !pointsConfig || unifiedStatus === 'COMPLETED') {
            setProgressState({
                percentage: 0,
                stage: 'safe',
                remainingMinutes: 0,
                isOverdue: false,
                pointsAtRisk: 0,
                pointsReward: 0
            });
            return;
        }
        
        const calculateProgress = () => {
            const now = new Date();
            const created = request.createdAt?.toDate ? request.createdAt.toDate() : new Date(request.createdAt);
            const elapsed = Math.floor((now.getTime() - created.getTime()) / 1000); // seconds
            
            // Get target time from points config based on request type and department
            let targetMinutes = 30; // Default
            
            const dept = request.currentDepartment || REQUEST_TYPE_TO_DEPARTMENT[request.type] || 'housekeeping';
            const deptConfig = pointsConfig[dept] || pointsConfig.housekeeping || {};
            
            // Determine target time based on type
            if (request.type === 'cleaning' || request.type === 'inspection') {
                targetMinutes = deptConfig.delayTime || 30;
            } else if (request.type === 'maintenance') {
                targetMinutes = deptConfig.delayTime || 60;
            } else if (request.type === 'bellman') {
                targetMinutes = deptConfig.delayTime || 20;
            } else if (request.type === 'procurement') {
                targetMinutes = deptConfig.targetTime || 1440; // 1 day default
            }
            
            // Use targetCompletionTime if available
            if (request.targetCompletionTime) {
                const target = request.targetCompletionTime.toDate ? request.targetCompletionTime.toDate() : new Date(request.targetCompletionTime);
                targetMinutes = Math.floor((target.getTime() - created.getTime()) / 60000);
            }
            
            const targetSeconds = targetMinutes * 60;
            const elapsedMinutes = Math.floor(elapsed / 60);
            const remainingSeconds = targetSeconds - elapsed;
            const remainingMinutes = Math.floor(remainingSeconds / 60);
            const percentage = Math.min(100, (elapsed / targetSeconds) * 100);
            const isOverdue = elapsed > targetSeconds;
            
            // Determine stage
            let stage: 'safe' | 'warning' | 'critical' = 'safe';
            if (percentage >= 90 || isOverdue) {
                stage = 'critical';
            } else if (percentage >= 60) {
                stage = 'warning';
            }
            
            // Calculate points (Real-time calculation based on current progress)
            let pointsAtRisk = 0;
            let pointsReward = 0;
            
            if (isOverdue) {
                // Calculate negative points stream (per minute delay)
                const delayMinutes = Math.floor((elapsed - targetSeconds) / 60);
                const delayPenalty = deptConfig.delay || -1;
                // Points deducted per 5 minutes of delay (configurable)
                const penaltyInterval = 5; // minutes
                pointsAtRisk = Math.abs(delayPenalty) * Math.ceil(delayMinutes / penaltyInterval);
            } else {
                // Calculate potential reward based on current progress
                const fastTime = deptConfig.fastTime || Math.floor(targetMinutes * 0.8);
                const normalTime = deptConfig.delayTime || targetMinutes;
                
                // If still in safe zone (0-60%), show fast reward
                if (percentage < 60 && elapsedMinutes <= fastTime) {
                    pointsReward = deptConfig.fast || 2;
                } 
                // If in warning zone (60-90%), show normal reward
                else if (percentage < 90 && elapsedMinutes <= normalTime) {
                    pointsReward = deptConfig.complete || deptConfig.completeOccupied || 1;
                }
                // If approaching deadline, show base reward
                else {
                    pointsReward = deptConfig.complete || 1;
                }
            }
            
            setProgressState({
                percentage,
                stage,
                remainingMinutes: Math.max(0, remainingMinutes),
                isOverdue,
                pointsAtRisk,
                pointsReward
            });
        };
        
        calculateProgress();
        const interval = setInterval(calculateProgress, 1000); // Update every second
        
        return () => clearInterval(interval);
    }, [normalizedRequest, pointsConfig, unifiedStatus]);
    
    // Get status config
    const statusConfig = useMemo(() => {
        const configs: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
            'NEW': {
                label: t('common.new') || 'جديد',
                color: 'text-orange-400',
                bg: 'bg-orange-500/20 border-orange-500/50',
                icon: <Clock className="w-3.5 h-3.5" />
            },
            'IN_PROGRESS': {
                label: t('reception.statusLabels.inProgress') || 'قيد التنفيذ',
                color: 'text-blue-400',
                bg: 'bg-blue-500/20 border-blue-500/50',
                icon: <PlayCircle className="w-3.5 h-3.5" />
            },
            'COMPLETED': {
                label: t('reception.statusLabels.completed') || 'مكتمل',
                color: 'text-green-400',
                bg: 'bg-green-500/20 border-green-500/50',
                icon: <CheckCircle className="w-3.5 h-3.5" />
            }
        };
        
        return configs[unifiedStatus] || configs['NEW'];
    }, [unifiedStatus, t]);
    
    // Get type icon
    const typeIcon = useMemo(() => {
        const icons: Record<string, React.ReactNode> = {
            cleaning: <Sparkles className="w-4 h-4 text-blue-400" />,
            maintenance: <Wrench className="w-4 h-4 text-orange-400" />,
            bellman: <BellRing className="w-4 h-4 text-yellow-400" />,
            procurement: <ShoppingCart className="w-4 h-4 text-purple-400" />,
            coffee: <Package className="w-4 h-4 text-amber-400" />,
            inspection: <CheckCircle className="w-4 h-4 text-teal-400" />
        };
        return icons[normalizedRequest.type] || <Package className="w-4 h-4 text-gray-400" />;
    }, [normalizedRequest.type]);
    
    // Format time ago
    const timeAgo = useMemo(() => {
        if (!normalizedRequest.createdAt) return '';
        const date = normalizedRequest.createdAt.toDate ? normalizedRequest.createdAt.toDate() : new Date(normalizedRequest.createdAt);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return t('reception.timeAgo.now') || 'الآن';
        if (diff < 60) return `${diff}${t('reception.timeAgo.minutes') || 'د'}`;
        if (diff < 1440) return `${Math.floor(diff / 60)}${t('reception.timeAgo.hours') || 'س'}`;
        return `${Math.floor(diff / 1440)}${t('reception.timeAgo.days') || 'يوم'}`;
    }, [normalizedRequest.createdAt, t]);
    
    // Check if QR request
    const isQR = normalizedRequest.source === 'guest' || normalizedRequest.source === 'QR';
    
    return (
        <div
            onClick={onView}
            className={`
                p-3 sm:p-4 rounded-xl cursor-pointer transition-all duration-200
                hover:scale-[1.01] active:scale-[0.99] adora-card border shadow-sm
                ${isActionRequiredByReception ? 'border-teal-500 ring-2 ring-teal-500/30 reception-alert-pulse' : 'adora-border'}
                ${normalizedRequest.priority === 'urgent' ? 'border-red-500/50 ring-1 ring-red-500/30' : ''}
                ${progressState.stage === 'critical' ? 'border-red-500/70 ring-2 ring-red-500/40' : ''}
                ${className}
            `}
        >
            {/* Row 1: Room + Type + Status */}
            <div className="flex items-center gap-2 mb-3">
                {/* Room Icon */}
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg, rgba(32, 178, 170, 0.2) 0%, rgba(20, 184, 166, 0.3) 100%)' }}>
                    <span className="text-sm font-bold" style={{ color: '#20B2AA' }}>{normalizedRequest.roomNumber}</span>
                </div>
                
                {/* Type & Guest Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <div className="flex items-center gap-1">
                            {typeIcon}
                            <span className="text-[10px] adora-text-secondary">
                                {request.type === 'cleaning' ? 'تنظيف' :
                                 request.type === 'maintenance' ? 'صيانة' :
                                 request.type === 'bellman' ? 'بيلمان' :
                                 request.type === 'procurement' ? 'مشتريات' :
                                 request.type === 'coffee' ? 'كافي شوب' : request.type}
                            </span>
                        </div>
                        {isQR && (
                            <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400 text-[9px] font-bold flex items-center gap-0.5 border border-teal-500/30">
                                <QrCode className="w-2.5 h-2.5" /> QR
                            </span>
                        )}
                        {request.priority === 'urgent' && (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        )}
                    </div>
                    <p className="text-[10px] adora-text-secondary truncate">{normalizedRequest.guestName || t('common.guest')}</p>
                </div>
                
                {/* Status Badge */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 ${statusConfig.bg} ${statusConfig.color} border`}>
                        {statusConfig.icon}
                        <span>{statusConfig.label}</span>
                    </div>
                    <span className="text-[10px] adora-text-disabled">{timeAgo}</span>
                </div>
            </div>
            
            {/* Row 2: QR Data Fields (if QR request) */}
            {isQR && (normalizedRequest.guestIdentity || normalizedRequest.guestPhone) && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                    {normalizedRequest.guestIdentity && (
                        <div className="flex items-center gap-1.5 flex-1">
                            <CreditCard className="w-3 h-3 text-teal-500 flex-shrink-0" />
                            <span className="text-[10px] text-teal-700 dark:text-teal-300">
                                <span className="font-medium">{t('reception.guest.identity') || 'الهوية'}:</span> {normalizedRequest.guestIdentity}
                            </span>
                        </div>
                    )}
                    {normalizedRequest.guestPhone && (
                        <div className="flex items-center gap-1.5 flex-1">
                            <Phone className="w-3 h-3 text-teal-500 flex-shrink-0" />
                            <span className="text-[10px] text-teal-700 dark:text-teal-300">
                                <span className="font-medium">{t('reception.guest.phone') || 'الجوال'}:</span> {normalizedRequest.guestPhone}
                            </span>
                        </div>
                    )}
                </div>
            )}
            
            {/* Row 3: Journey Info (Previous/Next) */}
            {journeyInfo.previousAction && (
                <div className="flex items-center gap-2 mb-2 p-1.5 rounded-lg bg-slate-500/5 border border-slate-500/10">
                    <History className="w-3 h-3 adora-text-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-[10px] adora-text-secondary">
                            <span className="font-medium">من:</span> {journeyInfo.previousDepartment || 'الاستقبال'} → {journeyInfo.previousAction}
                        </div>
                        {journeyInfo.nextStep && (
                            <div className="text-[10px] adora-text-tertiary mt-0.5">
                                <span className="font-medium">التالي:</span> {journeyInfo.nextStep} {journeyInfo.nextDepartment && `→ ${journeyInfo.nextDepartment}`}
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {/* Row 4: Dynamic Progress Bar (The Pulse) */}
            {unifiedStatus !== 'COMPLETED' && (
                <div className="mb-2">
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden bg-white/10 mb-1">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                                progressState.stage === 'critical' 
                                    ? 'bg-red-500 progress-pulse' 
                                    : progressState.stage === 'warning'
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                            }`}
                            style={{
                                width: `${Math.min(100, progressState.percentage)}%`,
                                boxShadow: progressState.stage === 'critical' 
                                    ? '0 0 10px rgba(239, 68, 68, 0.6)' 
                                    : progressState.stage === 'warning'
                                    ? '0 0 8px rgba(234, 179, 8, 0.4)'
                                    : '0 0 4px rgba(34, 197, 94, 0.3)'
                            }}
                        />
                    </div>
                    
                    {/* Progress Info */}
                    <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-2">
                            {progressState.isOverdue ? (
                                <>
                                    <TrendingDown className="w-3 h-3 text-red-400" />
                                    <span className="text-red-400 font-bold">
                                        متأخر {Math.abs(progressState.remainingMinutes)} د
                                    </span>
                                    {progressState.pointsAtRisk > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                                            -{progressState.pointsAtRisk} نقاط
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Clock className="w-3 h-3" style={{ color: progressState.stage === 'critical' ? '#ef4444' : progressState.stage === 'warning' ? '#eab308' : '#22c55e' }} />
                                    <span style={{ color: progressState.stage === 'critical' ? '#ef4444' : progressState.stage === 'warning' ? '#eab308' : '#22c55e' }}>
                                        باقي {progressState.remainingMinutes} د
                                    </span>
                                    {progressState.pointsReward > 0 && progressState.stage === 'safe' && (
                                        <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-0.5">
                                            <TrendingUp className="w-2.5 h-2.5" />
                                            +{progressState.pointsReward}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <span className="adora-text-tertiary">
                            {Math.round(progressState.percentage)}%
                        </span>
                    </div>
                </div>
            )}
            
            {/* Row 5: Reception Alert (if action required) */}
            {isActionRequiredByReception && viewMode === 'reception' && (
                <div className="mb-2 p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center gap-2">
                    <Target className="w-4 h-4 text-teal-400" />
                    <span className="text-[10px] text-teal-700 dark:text-teal-300 font-medium">
                        {t('reception.actionRequired') || 'يتطلب إجراء من الاستقبال'}
                    </span>
                </div>
            )}
            
            {/* Row 6: Notes (if available) */}
            {normalizedRequest.notes && normalizedRequest.notes.trim() && (
                <div className="mb-2 p-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
                    <p className="text-[10px] adora-text-secondary line-clamp-2">{normalizedRequest.notes}</p>
                </div>
            )}
            
            {/* Row 7: Action Buttons */}
            {onAction && (
                <div className="flex gap-2 pt-2 border-t adora-border">
                    {unifiedStatus === 'NEW' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAction('start'); }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-teal-600 transition-colors"
                        >
                            <PlayCircle className="w-3 h-3" /> {t('common.start') || 'بدء'}
                        </button>
                    )}
                    {unifiedStatus === 'IN_PROGRESS' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAction('complete'); }}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-green-500 text-white text-xs font-bold flex items-center justify-center gap-1 hover:bg-green-600 transition-colors"
                        >
                            <CheckCircle className="w-3 h-3" /> {t('common.complete') || 'إكمال'}
                        </button>
                    )}
                    {onView && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onView(); }}
                            className="py-1.5 px-3 rounded-lg text-xs font-medium adora-bg-tertiary adora-text-secondary hover:adora-bg-secondary transition-colors"
                        >
                            {t('reception.details') || 'تفاصيل'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default UniversalActionCard;
