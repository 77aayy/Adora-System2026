/**
 * Points Notification Component
 * Simple notification showing points rewards/penalties for active requests
 * Displays for 3 seconds then auto-dismisses
 * Adora Hotel Management System V2
 */

import React, { useEffect, useState } from 'react';
import { Award, AlertTriangle, Clock } from 'lucide-react';
import { getPointsConfig } from '../../services/pointsService';

interface PointsNotificationProps {
    requestId: string;
    requestType: string;
    department: 'housekeeping' | 'maintenance' | 'bellman' | 'reception' | 'procurement';
    createdAt: any; // Timestamp
    tenantId: string;
    onDismiss?: () => void;
}

export const PointsNotification: React.FC<PointsNotificationProps> = ({
    requestId,
    requestType,
    department,
    createdAt,
    tenantId,
    onDismiss
}) => {
    const [pointsInfo, setPointsInfo] = useState<{
        fastPoints: number;
        fastTime: number;
        penaltyPoints: number;
        penaltyTime: number;
        message: string;
    } | null>(null);

    useEffect(() => {
        const loadPointsInfo = async () => {
            try {
                const config = await getPointsConfig(tenantId);
                const deptConfig = config[department];

                if (!deptConfig) return;

                let info: any = {};

                // Department-specific logic
                // Cast deptConfig to any for accessing department-specific properties
                const cfg = deptConfig as any;
                
                switch (department) {
                    case 'housekeeping':
                        info = {
                            fastPoints: cfg.fast || 2,
                            fastTime: cfg.fastTime || 25,
                            penaltyPoints: cfg.delay || -1,
                            penaltyTime: cfg.delayTime || 30,
                            message: `في حال إتمام العملية قبل ${cfg.fastTime || 25} دقيقة سوف يتم منحك ${cfg.fast || 2} نقاط. وفي حال انتهاء بعد ${cfg.delayTime || 30} دقيقة سوف يتم خصم منك ${Math.abs(cfg.delay || -1)} نقاط.`
                        };
                        break;

                    case 'bellman':
                        info = {
                            fastPoints: cfg.fast || 2,
                            fastTime: cfg.fastTime || 10,
                            penaltyPoints: cfg.delay || -1,
                            penaltyTime: cfg.delayTime || 20,
                            message: `في حال إتمام العملية قبل ${cfg.fastTime || 10} دقيقة سوف يتم منحك ${cfg.fast || 2} نقاط. وفي حال انتهاء بعد ${cfg.delayTime || 20} دقيقة سوف يتم خصم منك ${Math.abs(cfg.delay || -1)} نقاط.`
                        };
                        break;

                    case 'reception':
                        const receptionConfig = cfg;
                        info = {
                            fastPoints: 0, // Reception has confirmation speed logic
                            fastTime: receptionConfig.targetConfirmationTime || 3,
                            penaltyPoints: receptionConfig.lateConfirmationPenalty || -1,
                            penaltyTime: receptionConfig.lateConfirmationTime || 5,
                            message: `في حال تأكيد الطلب قبل ${receptionConfig.targetConfirmationTime || 3} دقائق سوف يتم منحك 1 نقطة. وفي حال التأكيد بعد ${receptionConfig.lateConfirmationTime || 5} دقائق سوف يتم خصم منك ${Math.abs(receptionConfig.lateConfirmationPenalty || -1)} نقاط.`
                        };
                        break;

                    case 'maintenance':
                        info = {
                            fastPoints: cfg.complete || 1,
                            fastTime: 30, // Default for maintenance
                            penaltyPoints: -1,
                            penaltyTime: 45,
                            message: `في حال إتمام العملية سوف يتم منحك ${cfg.complete || 1} نقطة. وفي حال التأخير سوف يتم خصم منك 1 نقطة.`
                        };
                        break;

                    case 'procurement':
                        const procConfig = cfg;
                        const targetHours = procConfig.targetTime ? Math.floor(procConfig.targetTime / 60) : 1440;
                        info = {
                            fastPoints: procConfig.early || 2,
                            fastTime: targetHours,
                            penaltyPoints: procConfig.delay || -2,
                            penaltyTime: targetHours,
                            message: `في حال استلام الطلب مبكراً سوف يتم منحك ${procConfig.early || 2} نقاط. وفي حال التأخير سوف يتم خصم منك ${Math.abs(procConfig.delay || -2)} نقاط.`
                        };
                        break;

                    default:
                        return;
                }

                setPointsInfo(info);

                // Auto-dismiss after 3 seconds
                const timer = setTimeout(() => {
                    if (onDismiss) onDismiss();
                }, 3000);

                return () => clearTimeout(timer);
            } catch (error) {
                console.error('Error loading points info:', error);
            }
        };

        loadPointsInfo();
    }, [requestId, requestType, department, tenantId, onDismiss]);

    if (!pointsInfo) return null;

    const isPenalty = pointsInfo.penaltyPoints < 0;

    return (
        <div className="fixed top-20 right-4 z-50 animate-slide-in-right">
            <div className={`
                p-3 sm:p-4 rounded-xl border shadow-xl max-w-sm bg-white dark:bg-slate-800
                ${isPenalty ? 'border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10' : 'border-teal-300 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/10'}
            `}>
                <div className="flex items-start gap-3">
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                        ${isPenalty ? 'bg-orange-500/20' : 'bg-teal-500/20'}
                    `}>
                        {isPenalty ? (
                            <AlertTriangle className="w-5 h-5 text-orange-400" />
                        ) : (
                            <Award className="w-5 h-5 text-teal-400" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Clock className="w-4 h-4 text-white/60" />
                            <span className="text-xs font-bold text-white/90">
                                {isPenalty ? '⚠️ انتبه للنقاط!' : '⭐ فرصة للنقاط!'}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-white/90 leading-relaxed">
                            {pointsInfo.message}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
