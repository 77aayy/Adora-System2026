/**
 * 🔄 Overflow Alert Component
 * ===========================
 * يعرض تنبيهات عند تجاوز حد المهام لأي قسم
 * يُستخدم في لوحة الاستقبال
 */

import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, Users, Sparkles, ArrowRight, X, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
    subscribeToOverflowAlerts, 
    OverflowStatus,
    DEPARTMENT_NAMES 
} from '../../services/overflowService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface OverflowAlertProps {
    tenantId: string;
    branchId: string;
    onReroute?: (fromDepartment: string, toDepartment: string) => void;
    className?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEPARTMENT ICONS & COLORS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEPARTMENT_CONFIG: Record<string, { color: string; bgColor: string; icon: string }> = {
    bellman: { 
        color: 'text-blue-400', 
        bgColor: 'bg-blue-500/20 border-blue-500/40', 
        icon: '🧳' 
    },
    housekeeping: { 
        color: 'text-green-400', 
        bgColor: 'bg-green-500/20 border-green-500/40', 
        icon: '🧹' 
    },
    maintenance: { 
        color: 'text-yellow-400', 
        bgColor: 'bg-yellow-500/20 border-yellow-500/40', 
        icon: '🔧' 
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const OverflowAlert: React.FC<OverflowAlertProps> = ({
    tenantId,
    branchId,
    onReroute,
    className = ''
}) => {
    const [statuses, setStatuses] = useState<OverflowStatus[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Subscribe to overflow changes
    useEffect(() => {
        if (!tenantId || !branchId) return;

        const unsubscribe = subscribeToOverflowAlerts(tenantId, branchId, setStatuses);
        return () => unsubscribe();
    }, [tenantId, branchId]);

    // Filter to only show overloaded departments that aren't dismissed
    const activeAlerts = statuses.filter(
        s => s.isOverloaded && !dismissed.has(s.department)
    );

    // Handle dismiss
    const handleDismiss = useCallback((department: string) => {
        setDismissed(prev => new Set([...prev, department]));
        // Auto-undismiss after 5 minutes
        setTimeout(() => {
            setDismissed(prev => {
                const next = new Set(prev);
                next.delete(department);
                return next;
            });
        }, 5 * 60 * 1000);
    }, []);

    // Handle reroute suggestion
    const handleReroute = useCallback((from: string, to: string) => {
        onReroute?.(from, to);
    }, [onReroute]);

    // Don't render if no alerts
    if (activeAlerts.length === 0) return null;

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div 
                className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-t-xl cursor-pointer"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/30 flex items-center justify-center animate-pulse">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-amber-300">
                            ⚠️ تنبيه ضغط العمل
                        </h4>
                        <p className="text-xs text-white/60">
                            {activeAlerts.length} قسم يحتاج اهتمام
                        </p>
                    </div>
                </div>
                <button className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    <RefreshCw className={`w-4 h-4 text-white/60 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Alerts List */}
            {!isCollapsed && (
                <div className="bg-slate-800/50 border border-t-0 border-amber-500/30 rounded-b-xl divide-y divide-white/10">
                    {activeAlerts.map((status) => {
                        const config = DEPARTMENT_CONFIG[status.department];
                        const departmentName = DEPARTMENT_NAMES[status.department];
                        const alternativeName = status.suggestedAlternative 
                            ? DEPARTMENT_NAMES[status.suggestedAlternative] 
                            : null;

                        return (
                            <div 
                                key={status.department}
                                className="p-3 flex items-start gap-3"
                            >
                                {/* Icon */}
                                <div className={`w-10 h-10 rounded-xl ${config.bgColor} border flex items-center justify-center text-lg flex-shrink-0`}>
                                    {config.icon}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-bold ${config.color}`}>
                                            {departmentName}
                                        </span>
                                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                                            مشغول {status.overloadPercentage}%
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="h-1.5 bg-white/10 rounded-full mb-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all ${
                                                status.overloadPercentage >= 100 
                                                    ? 'bg-red-500' 
                                                    : status.overloadPercentage >= 80 
                                                    ? 'bg-amber-500' 
                                                    : 'bg-green-500'
                                            }`}
                                            style={{ width: `${Math.min(status.overloadPercentage, 100)}%` }}
                                        />
                                    </div>

                                    <p className="text-xs text-white/60 mb-2">
                                        <Users className="w-3 h-3 inline mr-1" />
                                        {status.currentTasks} مهمة من أصل {status.maxTasks}
                                    </p>

                                    {/* Suggestion */}
                                    {alternativeName && (
                                        <button
                                            onClick={() => handleReroute(status.department, status.suggestedAlternative!)}
                                            className="flex items-center gap-2 text-xs bg-teal-500/20 text-teal-400 px-3 py-1.5 rounded-lg hover:bg-teal-500/30 transition-colors"
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            <span>تحويل للـ {alternativeName}</span>
                                            <ArrowRight className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Dismiss */}
                                <button
                                    onClick={() => handleDismiss(status.department)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white/80"
                                    title="إخفاء مؤقتاً"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPACT VERSION (for sidebar/header)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface OverflowBadgeProps {
    tenantId: string;
    branchId: string;
    onClick?: () => void;
}

export const OverflowBadge: React.FC<OverflowBadgeProps> = ({
    tenantId,
    branchId,
    onClick
}) => {
    const [statuses, setStatuses] = useState<OverflowStatus[]>([]);

    useEffect(() => {
        if (!tenantId || !branchId) return;
        const unsubscribe = subscribeToOverflowAlerts(tenantId, branchId, setStatuses);
        return () => unsubscribe();
    }, [tenantId, branchId]);

    const overloadedCount = statuses.filter(s => s.isOverloaded).length;

    if (overloadedCount === 0) return null;

    return (
        <button
            onClick={onClick}
            className="relative p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl hover:bg-amber-500/30 transition-colors"
            title={`${overloadedCount} قسم مشغول`}
        >
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {overloadedCount}
            </span>
        </button>
    );
};

export default OverflowAlert;
