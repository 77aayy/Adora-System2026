/**
 * Request Timer Component
 * Real-time countdown/timer for request cards
 * Shows remaining time or delay status with points deduction warnings
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle, TrendingDown } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface RequestTimerProps {
    createdAt: any;
    targetCompletionTime?: any; // Target completion time
    delayThreshold?: number; // Delay threshold in minutes (default: 15)
    onDelayUpdate?: (isDelayed: boolean, delayMinutes: number) => void;
}

interface TimeDisplay {
    value: number;
    unit: 'second' | 'minute' | 'hour' | 'day';
    label: string;
    isDelayed: boolean;
    delayMinutes: number;
    pointsLost: number;
}

export const RequestTimer: React.FC<RequestTimerProps> = ({
    createdAt,
    targetCompletionTime,
    delayThreshold = 15, // Default 15 minutes
    onDelayUpdate
}) => {
    const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>({
        value: 0,
        unit: 'second',
        label: '0 ثانية',
        isDelayed: false,
        delayMinutes: 0,
        pointsLost: 0
    });

    useEffect(() => {
        if (!createdAt) return;

        const calculateTime = () => {
            const now = new Date();
            const created = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
            const elapsed = Math.floor((now.getTime() - created.getTime()) / 1000); // seconds

            let targetTime: Date | null = null;
            if (targetCompletionTime) {
                targetTime = targetCompletionTime?.toDate ? targetCompletionTime.toDate() : new Date(targetCompletionTime);
            } else {
                // Calculate target time from createdAt + delayThreshold
                targetTime = new Date(created.getTime() + delayThreshold * 60 * 1000);
            }

            const targetSeconds = Math.floor((targetTime.getTime() - created.getTime()) / 1000);
            const remainingSeconds = targetSeconds - elapsed;
            const isDelayed = elapsed > targetSeconds;
            const delaySeconds = isDelayed ? elapsed - targetSeconds : 0;
            const delayMinutes = Math.floor(delaySeconds / 60);

            // Calculate points lost (1 point per 5 minutes delay, max 10 points)
            const pointsLost = Math.min(Math.floor(delayMinutes / 5), 10);

            // Update callback
            if (onDelayUpdate) {
                onDelayUpdate(isDelayed, delayMinutes);
            }

            let display: TimeDisplay;

            if (isDelayed) {
                // Show delay status
                const days = Math.floor(delayMinutes / (24 * 60));
                const hours = Math.floor((delayMinutes % (24 * 60)) / 60);
                const minutes = delayMinutes % 60;
                const seconds = delaySeconds % 60;

                let value: number;
                let unit: 'second' | 'minute' | 'hour' | 'day';
                let label: string;

                if (days > 0) {
                    value = days;
                    unit = 'day';
                    label = days === 1 
                        ? `يوم واحد${hours > 0 ? ` و ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}` : ''}${minutes > 0 && hours === 0 ? ` و ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}` : ''}`
                        : `${days} أيام${hours > 0 ? ` و ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}` : ''}${minutes > 0 && hours === 0 ? ` و ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}` : ''}`;
                } else if (hours > 0) {
                    value = hours;
                    unit = 'hour';
                    label = hours === 1
                        ? `ساعة واحدة${minutes > 0 ? ` و ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}` : ''}`
                        : `${hours} ساعات${minutes > 0 ? ` و ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}` : ''}`;
                } else if (minutes > 0) {
                    value = minutes;
                    unit = 'minute';
                    label = minutes === 1
                        ? `دقيقة واحدة${seconds > 0 ? ` و ${seconds} ${seconds === 1 ? 'ثانية' : 'ثواني'}` : ''}`
                        : `${minutes} دقائق${seconds > 0 ? ` و ${seconds} ${seconds === 1 ? 'ثانية' : 'ثواني'}` : ''}`;
                } else {
                    value = seconds;
                    unit = 'second';
                    label = seconds === 1 ? 'ثانية واحدة' : `${seconds} ثواني`;
                }

                display = {
                    value,
                    unit,
                    label: `متأخر بـ ${label}`,
                    isDelayed: true,
                    delayMinutes,
                    pointsLost
                };
            } else {
                // Show remaining time (always show most relevant unit)
                const days = Math.floor(remainingSeconds / (24 * 60 * 60));
                const hours = Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60));
                const minutes = Math.floor((remainingSeconds % (60 * 60)) / 60);
                const seconds = remainingSeconds % 60;

                let value: number;
                let unit: 'second' | 'minute' | 'hour' | 'day';
                let label: string;

                // Warning thresholds
                const isNearDeadline = remainingSeconds < 180; // Less than 3 minutes
                const isCloseToDeadline = remainingSeconds < 300; // Less than 5 minutes
                const isVeryClose = remainingSeconds < 60; // Less than 1 minute

                // Show seconds if less than 1 minute
                if (remainingSeconds < 60) {
                    value = seconds;
                    unit = 'second';
                    label = `${seconds} ${seconds === 1 ? 'ثانية' : seconds === 2 ? 'ثانيتان' : seconds >= 3 && seconds <= 10 ? 'ثواني' : 'ثانية'}`;
                }
                // Show minutes if less than 1 hour
                else if (remainingSeconds < 3600) {
                    value = minutes;
                    unit = 'minute';
                    // Show seconds if less than 5 minutes
                    if (remainingSeconds < 300 && seconds > 0) {
                        label = `${minutes} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتان' : 'دقائق'} و ${seconds} ${seconds === 1 ? 'ثانية' : 'ثواني'}`;
                    } else {
                        label = `${minutes} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتان' : 'دقائق'}`;
                    }
                }
                // Show hours if less than 1 day
                else if (remainingSeconds < 86400) {
                    value = hours;
                    unit = 'hour';
                    // Show minutes if less than 5 hours
                    if (remainingSeconds < 18000 && minutes > 0) {
                        label = `${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعات'} و ${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
                    } else {
                        label = `${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : 'ساعات'}`;
                    }
                }
                // Show days
                else {
                    value = days;
                    unit = 'day';
                    // Show hours if less than 5 days
                    if (remainingSeconds < 432000 && hours > 0) {
                        label = `${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'} و ${hours} ${hours === 1 ? 'ساعة' : 'ساعات'}`;
                    } else {
                        label = `${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومان' : 'أيام'}`;
                    }
                }

                let displayLabel = label;
                if (isVeryClose) {
                    displayLabel = `⚠️ باقي ${label} وسوف تخسر النقاط`;
                } else if (isNearDeadline) {
                    displayLabel = `⚠️ باقي ${label} وسوف تخسر النقاط`;
                } else if (isCloseToDeadline) {
                    displayLabel = `⏰ باقي ${label}`;
                }

                display = {
                    value,
                    unit,
                    label: displayLabel,
                    isDelayed: false,
                    delayMinutes: 0,
                    pointsLost: 0
                };
            }

            setTimeDisplay(display);
        };

        // Calculate immediately
        calculateTime();

        // Update every second
        const interval = setInterval(calculateTime, 1000);

        return () => clearInterval(interval);
    }, [createdAt, targetCompletionTime, delayThreshold, onDelayUpdate]);

    // Determine color based on status
    const getColor = () => {
        if (timeDisplay.isDelayed) {
            if (timeDisplay.pointsLost >= 5) return 'text-red-400';
            if (timeDisplay.pointsLost >= 2) return 'text-orange-400';
            return 'text-yellow-400';
        }
        if (timeDisplay.unit === 'second' || (timeDisplay.unit === 'minute' && timeDisplay.value < 5)) {
            return 'text-red-400';
        }
        if (timeDisplay.unit === 'minute' && timeDisplay.value < 15) {
            return 'text-yellow-400';
        }
        return 'text-blue-400';
    };

    const getBgColor = () => {
        if (timeDisplay.isDelayed) {
            if (timeDisplay.pointsLost >= 5) return 'bg-red-500/20 border-red-500/30';
            if (timeDisplay.pointsLost >= 2) return 'bg-orange-500/20 border-orange-500/30';
            return 'bg-yellow-500/20 border-yellow-500/30';
        }
        if (timeDisplay.unit === 'second' || (timeDisplay.unit === 'minute' && timeDisplay.value < 5)) {
            return 'bg-red-500/20 border-red-500/30';
        }
        if (timeDisplay.unit === 'minute' && timeDisplay.value < 15) {
            return 'bg-yellow-500/20 border-yellow-500/30';
        }
        return 'bg-blue-500/20 border-blue-500/30';
    };

    return (
        <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border ${getBgColor()} transition-all`}>
            <Clock className={`w-3.5 h-3.5 ${getColor()} ${timeDisplay.isDelayed ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-medium ${getColor()} whitespace-nowrap`}>
                {timeDisplay.label}
            </span>
            {timeDisplay.isDelayed && timeDisplay.pointsLost > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/30 border border-red-500/50">
                    <TrendingDown className="w-3 h-3 text-red-400" />
                    <span className="text-xs font-bold text-red-400">
                        -{timeDisplay.pointsLost} نقاط
                    </span>
                </div>
            )}
            {!timeDisplay.isDelayed && timeDisplay.unit === 'second' && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/30 border border-red-500/50 animate-pulse">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    <span className="text-xs font-bold text-red-400">
                        تحذير
                    </span>
                </div>
            )}
        </div>
    );
};
