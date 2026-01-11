/**
 * Department Points Progress Component
 * Unified points progress tracker for all departments
 * Shows current request timing, potential points, and progress bar
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Award, Clock, TrendingUp, TrendingDown, AlertTriangle,
    CheckCircle, Zap, Timer, Star, Gift
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getPointsConfig, getEmployeePoints } from '../../services/pointsService';
import { useTheme } from '../../context/ThemeContext';

// ============================================================
// TYPES
// ============================================================

export type DepartmentType = 'bellman' | 'housekeeping' | 'maintenance' | 'reception' | 'procurement' | 'coffeeshop';

interface DepartmentPointsProgressProps {
    department: DepartmentType;
    requestCreatedAt?: Date | any; // Current active request creation time
    requestStatus?: string;
    compact?: boolean;
    showEmployeePoints?: boolean;
    className?: string;
}

interface PointsConfig {
    fastPoints: number;
    fastTime: number;      // minutes
    normalPoints: number;
    penaltyPoints: number;
    penaltyTime: number;   // minutes
    graceDays?: number;    // أيام السماح (للمشتريات)
}

// ============================================================
// DEPARTMENT CONFIG
// ============================================================

const DEPARTMENT_COLORS: Record<DepartmentType, { gradient: string; text: string; icon: string }> = {
    bellman: { gradient: 'from-blue-500 to-cyan-500', text: 'text-blue-400', icon: '🧳' },
    housekeeping: { gradient: 'from-green-500 to-emerald-500', text: 'text-green-400', icon: '🧹' },
    maintenance: { gradient: 'from-yellow-500 to-orange-500', text: 'text-yellow-400', icon: '🔧' },
    reception: { gradient: 'from-purple-500 to-pink-500', text: 'text-purple-400', icon: '🛎️' },
    procurement: { gradient: 'from-orange-500 to-red-500', text: 'text-orange-400', icon: '🛒' },
    coffeeshop: { gradient: 'from-amber-500 to-brown-500', text: 'text-amber-400', icon: '☕' },
};

const DEPARTMENT_LABELS: Record<DepartmentType, string> = {
    bellman: 'البيلمان',
    housekeeping: 'النظافة',
    maintenance: 'الصيانة',
    reception: 'الاستقبال',
    procurement: 'المشتريات',
    coffeeshop: 'الكافي شوب',
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DepartmentPointsProgress: React.FC<DepartmentPointsProgressProps> = ({
    department,
    requestCreatedAt,
    requestStatus,
    compact = false,
    showEmployeePoints = true,
    className = '',
}) => {
    const { user, tenantId, branchId } = useAuth();
    const { isDark } = useTheme();
    
    const [config, setConfig] = useState<PointsConfig | null>(null);
    const [employeePoints, setEmployeePoints] = useState<number>(0);
    const [elapsedMinutes, setElapsedMinutes] = useState(0);
    const [loading, setLoading] = useState(true);
    
    const colors = DEPARTMENT_COLORS[department];
    
    // Load config and employee points
    useEffect(() => {
        const loadData = async () => {
            if (!tenantId) return;
            
            try {
                const pointsConfig = await getPointsConfig(tenantId);
                const deptConfig = (pointsConfig as any)[department];
                
                // Map department-specific config to unified format
                let mappedConfig: PointsConfig = {
                    fastPoints: 2,
                    fastTime: 10,
                    normalPoints: 1,
                    penaltyPoints: -1,
                    penaltyTime: 20,
                };
                
                switch (department) {
                    case 'bellman':
                        mappedConfig = {
                            fastPoints: deptConfig?.fast || 2,
                            fastTime: deptConfig?.fastTime || 10,
                            normalPoints: deptConfig?.complete || 1,
                            penaltyPoints: deptConfig?.delay || -1,
                            penaltyTime: deptConfig?.delayTime || 20,
                        };
                        break;
                        
                    case 'housekeeping':
                        mappedConfig = {
                            fastPoints: deptConfig?.fast || 2,
                            fastTime: deptConfig?.fastTime || 25,
                            normalPoints: deptConfig?.completeOccupied || 1,
                            penaltyPoints: deptConfig?.delay || -1,
                            penaltyTime: deptConfig?.delayTime || 30,
                        };
                        break;
                        
                    case 'maintenance':
                        mappedConfig = {
                            fastPoints: deptConfig?.complete || 1,
                            fastTime: 30,
                            normalPoints: deptConfig?.complete || 1,
                            penaltyPoints: -1,
                            penaltyTime: 60,
                        };
                        break;
                        
                    case 'reception':
                        mappedConfig = {
                            fastPoints: 1,
                            fastTime: deptConfig?.targetConfirmationTime || 3,
                            normalPoints: deptConfig?.confirm || 1,
                            penaltyPoints: deptConfig?.lateConfirmationPenalty || -1,
                            penaltyTime: deptConfig?.lateConfirmationTime || 5,
                        };
                        break;
                        
                    case 'procurement':
                        const targetHours = (deptConfig?.targetTime || 1440) / 60;
                        mappedConfig = {
                            fastPoints: deptConfig?.early || 2,
                            fastTime: targetHours * 60, // Convert to minutes
                            normalPoints: deptConfig?.ontime || 1,
                            penaltyPoints: deptConfig?.delay || -2,
                            penaltyTime: targetHours * 60,
                            graceDays: deptConfig?.graceDays || 1,
                        };
                        break;
                        
                    case 'coffeeshop':
                        mappedConfig = {
                            fastPoints: deptConfig?.fast || 2,
                            fastTime: deptConfig?.fastTime || 5,
                            normalPoints: deptConfig?.complete || 1,
                            penaltyPoints: deptConfig?.delay || -1,
                            penaltyTime: deptConfig?.delayTime || 10,
                        };
                        break;
                }
                
                setConfig(mappedConfig);
                
                // Load employee points
                if (showEmployeePoints && user?.id) {
                    const points = await getEmployeePoints(user.id, tenantId, branchId || '');
                    setEmployeePoints(points);
                }
            } catch (error) {
                console.error('Error loading points config:', error);
            }
            setLoading(false);
        };
        
        loadData();
    }, [tenantId, branchId, department, user?.id, showEmployeePoints]);
    
    // Calculate elapsed time
    useEffect(() => {
        if (!requestCreatedAt) {
            setElapsedMinutes(0);
            return;
        }
        
        const calculateElapsed = () => {
            const created = requestCreatedAt?.toDate?.() || new Date(requestCreatedAt);
            const now = new Date();
            const diff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
            setElapsedMinutes(Math.max(0, diff));
        };
        
        calculateElapsed();
        const interval = setInterval(calculateElapsed, 30000); // Update every 30 seconds
        
        return () => clearInterval(interval);
    }, [requestCreatedAt]);
    
    // Calculate progress and status
    const getProgressInfo = useCallback(() => {
        if (!config) return { progress: 0, status: 'loading', message: '' };
        
        const { fastTime, penaltyTime } = config;
        
        if (elapsedMinutes <= fastTime) {
            // Fast zone - Green
            const progress = (elapsedMinutes / fastTime) * 100;
            return {
                progress: Math.min(100, progress),
                status: 'fast',
                message: `أكمل قبل ${fastTime - elapsedMinutes} دقيقة للحصول على ${config.fastPoints} نقاط! ⚡`,
                color: 'green',
            };
        } else if (elapsedMinutes <= penaltyTime) {
            // Normal zone - Yellow
            const normalDuration = penaltyTime - fastTime;
            const normalElapsed = elapsedMinutes - fastTime;
            const progress = (normalElapsed / normalDuration) * 100;
            return {
                progress: Math.min(100, progress),
                status: 'normal',
                message: `بقي ${penaltyTime - elapsedMinutes} دقيقة قبل الخصم`,
                color: 'yellow',
            };
        } else {
            // Penalty zone - Red
            return {
                progress: 100,
                status: 'penalty',
                message: `تأخير! سيتم خصم ${Math.abs(config.penaltyPoints)} نقطة`,
                color: 'red',
            };
        }
    }, [config, elapsedMinutes]);
    
    const progressInfo = getProgressInfo();
    
    // Format time
    const formatTime = (minutes: number): string => {
        if (minutes < 60) return `${minutes} دقيقة`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours} ساعة و ${mins} دقيقة` : `${hours} ساعة`;
    };
    
    if (loading) {
        return (
            <div className={`animate-pulse rounded-2xl p-4 bg-white/5 ${className}`}>
                <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
                <div className="h-6 bg-white/10 rounded w-3/4"></div>
            </div>
        );
    }
    
    if (!config) return null;
    
    // Compact version
    if (compact) {
        return (
            <div className={`flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 ${className}`}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center`}>
                    <span className="text-lg">{colors.icon}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-sm">{DEPARTMENT_LABELS[department]}</span>
                        {showEmployeePoints && (
                            <span className={`text-sm font-bold ${colors.text}`}>
                                ⭐ {employeePoints} نقطة
                            </span>
                        )}
                    </div>
                    
                    {requestCreatedAt && (
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-black/30 overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${
                                        progressInfo.status === 'fast' ? 'bg-green-500' :
                                        progressInfo.status === 'normal' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${progressInfo.progress}%` }}
                                />
                            </div>
                            <span className="text-xs text-white/50">{formatTime(elapsedMinutes)}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    
    // Full version
    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/50 border-white/10' : 'bg-white border-slate-200'} ${className}`}>
            {/* Header */}
            <div className={`p-4 bg-gradient-to-r ${colors.gradient}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <span className="text-2xl">{colors.icon}</span>
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">{DEPARTMENT_LABELS[department]}</h3>
                            <p className="text-white/70 text-sm">مؤشر تقدم النقاط</p>
                        </div>
                    </div>
                    
                    {showEmployeePoints && (
                        <div className="text-left">
                            <div className="flex items-center gap-1 text-white">
                                <Star className="w-5 h-5 fill-yellow-300 text-yellow-300" />
                                <span className="text-2xl font-bold">{employeePoints}</span>
                            </div>
                            <p className="text-white/70 text-xs">نقاطي</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Progress Section */}
            <div className="p-4 space-y-4">
                {/* Time Zones */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className={`p-3 rounded-xl ${progressInfo.status === 'fast' ? 'bg-green-500/20 ring-2 ring-green-500' : 'bg-white/5'}`}>
                        <Zap className={`w-5 h-5 mx-auto mb-1 ${progressInfo.status === 'fast' ? 'text-green-400' : 'text-white/40'}`} />
                        <p className={`text-xs font-medium ${progressInfo.status === 'fast' ? 'text-green-400' : 'text-white/50'}`}>سريع</p>
                        <p className={`text-lg font-bold ${progressInfo.status === 'fast' ? 'text-green-400' : 'text-white/60'}`}>+{config.fastPoints}</p>
                        <p className="text-xs text-white/40">قبل {config.fastTime} د</p>
                    </div>
                    
                    <div className={`p-3 rounded-xl ${progressInfo.status === 'normal' ? 'bg-yellow-500/20 ring-2 ring-yellow-500' : 'bg-white/5'}`}>
                        <Clock className={`w-5 h-5 mx-auto mb-1 ${progressInfo.status === 'normal' ? 'text-yellow-400' : 'text-white/40'}`} />
                        <p className={`text-xs font-medium ${progressInfo.status === 'normal' ? 'text-yellow-400' : 'text-white/50'}`}>عادي</p>
                        <p className={`text-lg font-bold ${progressInfo.status === 'normal' ? 'text-yellow-400' : 'text-white/60'}`}>+{config.normalPoints}</p>
                        <p className="text-xs text-white/40">حتى {config.penaltyTime} د</p>
                    </div>
                    
                    <div className={`p-3 rounded-xl ${progressInfo.status === 'penalty' ? 'bg-red-500/20 ring-2 ring-red-500' : 'bg-white/5'}`}>
                        <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${progressInfo.status === 'penalty' ? 'text-red-400' : 'text-white/40'}`} />
                        <p className={`text-xs font-medium ${progressInfo.status === 'penalty' ? 'text-red-400' : 'text-white/50'}`}>متأخر</p>
                        <p className={`text-lg font-bold ${progressInfo.status === 'penalty' ? 'text-red-400' : 'text-white/60'}`}>{config.penaltyPoints}</p>
                        <p className="text-xs text-white/40">بعد {config.penaltyTime} د</p>
                    </div>
                </div>
                
                {/* Active Request Progress */}
                {requestCreatedAt && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-white/60">الوقت المنقضي</span>
                            <span className={`font-bold ${
                                progressInfo.status === 'fast' ? 'text-green-400' :
                                progressInfo.status === 'normal' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                                {formatTime(elapsedMinutes)}
                            </span>
                        </div>
                        
                        <div className="relative h-4 rounded-full bg-black/20 overflow-hidden">
                            {/* Fast zone */}
                            <div 
                                className="absolute h-full bg-green-500/30"
                                style={{ width: `${(config.fastTime / config.penaltyTime) * 100}%` }}
                            />
                            
                            {/* Progress */}
                            <div 
                                className={`absolute h-full transition-all duration-500 ${
                                    progressInfo.status === 'fast' ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                                    progressInfo.status === 'normal' ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                                    'bg-gradient-to-r from-red-500 to-red-400'
                                }`}
                                style={{ width: `${Math.min(100, (elapsedMinutes / config.penaltyTime) * 100)}%` }}
                            />
                            
                            {/* Markers */}
                            <div 
                                className="absolute top-0 w-0.5 h-full bg-white/50"
                                style={{ left: `${(config.fastTime / config.penaltyTime) * 100}%` }}
                            />
                        </div>
                        
                        {/* Message */}
                        <div className={`flex items-center gap-2 p-3 rounded-xl ${
                            progressInfo.status === 'fast' ? 'bg-green-500/10 border border-green-500/30' :
                            progressInfo.status === 'normal' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                            'bg-red-500/10 border border-red-500/30'
                        }`}>
                            {progressInfo.status === 'fast' ? (
                                <TrendingUp className="w-5 h-5 text-green-400" />
                            ) : progressInfo.status === 'normal' ? (
                                <Clock className="w-5 h-5 text-yellow-400" />
                            ) : (
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            )}
                            <span className={`text-sm font-medium ${
                                progressInfo.status === 'fast' ? 'text-green-400' :
                                progressInfo.status === 'normal' ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                                {progressInfo.message}
                            </span>
                        </div>
                    </div>
                )}
                
                {/* No active request */}
                {!requestCreatedAt && (
                    <div className="text-center py-4 text-white/40">
                        <Gift className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>لا يوجد طلب نشط حالياً</p>
                        <p className="text-xs mt-1">ابدأ طلباً جديداً لتتبع النقاط</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================
// COMPACT CARD VERSION
// ============================================================

export const PointsProgressCard: React.FC<{
    department: DepartmentType;
    completedToday: number;
    totalRequests: number;
    fastCount: number;
    penaltyCount: number;
}> = ({ department, completedToday, totalRequests, fastCount, penaltyCount }) => {
    const colors = DEPARTMENT_COLORS[department];
    
    const successRate = totalRequests > 0 ? Math.round((completedToday / totalRequests) * 100) : 0;
    
    return (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{colors.icon}</span>
                    <span className="text-white font-medium">{DEPARTMENT_LABELS[department]}</span>
                </div>
                <span className={`text-2xl font-bold ${colors.text}`}>{completedToday}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-green-500/10">
                    <Zap className="w-4 h-4 mx-auto text-green-400 mb-1" />
                    <span className="text-green-400 font-bold">{fastCount}</span>
                    <p className="text-white/40">سريع</p>
                </div>
                <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="w-4 h-4 mx-auto text-yellow-400 mb-1" />
                    <span className="text-yellow-400 font-bold">{completedToday - fastCount - penaltyCount}</span>
                    <p className="text-white/40">عادي</p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="w-4 h-4 mx-auto text-red-400 mb-1" />
                    <span className="text-red-400 font-bold">{penaltyCount}</span>
                    <p className="text-white/40">متأخر</p>
                </div>
            </div>
            
            <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/50">نسبة الإنجاز</span>
                    <span className={colors.text}>{successRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                    <div 
                        className={`h-full bg-gradient-to-r ${colors.gradient}`}
                        style={{ width: `${successRate}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default DepartmentPointsProgress;
