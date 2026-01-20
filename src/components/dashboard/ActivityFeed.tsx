/**
 * Activity Feed Component
 * Real-time activity stream with beautiful animations
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckCircle,
    Clock,
    AlertTriangle,
    Bell,
    Package,
    Sparkles,
    Wrench,
    BellRing,
    Coffee,
    Star,
    ArrowRight,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export interface ActivityItem {
    id: string;
    type: 'new' | 'complete' | 'delay' | 'points' | 'alert';
    serviceType?: 'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'inspection';
    roomNumber?: string;
    employeeName?: string;
    message: string;
    timestamp: Date;
    points?: number;
}

interface ActivityFeedProps {
    activities: ActivityItem[];
    title?: string;
    maxItems?: number;
    autoScroll?: boolean;
}

// ============================================================
// ACTIVITY CONFIG
// ============================================================

// ACTIVITY_CONFIG will be created with useMemo inside component
    delay: {
        icon: AlertTriangle,
        color: '#F59E0B',
        bg: 'from-amber-500/20 to-amber-600/5',
        label: 'تأخير',
    },
    points: {
        icon: Star,
        color: '#8B5CF6',
        bg: 'from-purple-500/20 to-purple-600/5',
        label: 'نقاط',
    },
    alert: {
        icon: AlertTriangle,
        color: '#EF4444',
        bg: 'from-red-500/20 to-red-600/5',
        label: 'تنبيه',
    },
};

const SERVICE_ICONS: Record<string, React.ComponentType<any>> = {
    cleaning: Sparkles,
    maintenance: Wrench,
    bellman: BellRing,
    coffee: Coffee,
    inspection: CheckCircle,
};

// ============================================================
// ACTIVITY ITEM COMPONENT
// ============================================================

const ActivityItemComponent: React.FC<{
    activity: ActivityItem;
    isNew: boolean;
    index: number;
}> = ({ activity, isNew, index }) => {
    const [isVisible, setIsVisible] = useState(!isNew);
    const config = ACTIVITY_CONFIG[activity.type];
    const ServiceIcon = activity.serviceType ? SERVICE_ICONS[activity.serviceType] : null;

    useEffect(() => {
        if (isNew) {
            const timer = setTimeout(() => setIsVisible(true), 50);
            return () => clearTimeout(timer);
        }
    }, [isNew]);

    const timeAgo = getTimeAgo(activity.timestamp);

    return (
        <div
            className={`
                relative overflow-hidden rounded-xl transition-all duration-500
                bg-gradient-to-r ${config.bg}
                border border-white/5 hover:border-white/10
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
                ${isNew ? 'animate-pulse-once' : ''}
            `}
            style={{ transitionDelay: isNew ? '0ms' : `${index * 30}ms` }}
        >
            <div className="flex items-start gap-4 p-4">
                {/* Icon */}
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                        background: `linear-gradient(135deg, ${config.color}40, ${config.color}20)`,
                        boxShadow: `0 0 20px ${config.color}30`,
                    }}
                >
                    <config.icon className="w-5 h-5" style={{ color: config.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {activity.roomNumber && (
                            <span
                                className="px-2 py-0.5 rounded text-xs font-bold"
                                style={{
                                    background: `${config.color}20`,
                                    color: config.color,
                                }}
                            >
                                غرفة {activity.roomNumber}
                            </span>
                        )}
                        {ServiceIcon && (
                            <ServiceIcon className="w-4 h-4 text-white/40" />
                        )}
                        {activity.points && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 rounded text-xs font-bold text-yellow-400">
                                <Star className="w-3 h-3" />
                                +{activity.points}
                            </span>
                        )}
                    </div>

                    <p className="text-sm text-white/80 leading-relaxed">
                        {activity.employeeName && (
                            <span className="font-semibold text-white">{activity.employeeName} </span>
                        )}
                        {activity.message}
                    </p>
                </div>

                {/* Time */}
                <div className="flex items-center gap-1 text-xs text-white/40 shrink-0">
                    <Clock className="w-3 h-3" />
                    {timeAgo}
                </div>
            </div>

            {/* Animated border for new items */}
            {isNew && (
                <div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    style={{
                        background: `linear-gradient(90deg, transparent, ${config.color}30, transparent)`,
                        animation: 'slide-border 1s ease-out forwards',
                    }}
                />
            )}
        </div>
    );
};

// ============================================================
// TIME HELPER
// ============================================================

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `${diffMins} د`;
    if (diffHours < 24) return `${diffHours} س`;
    return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
    activities,
    title = '📰 آخر الأنشطة',
    maxItems = 20,
    autoScroll = true,
}) => {
    const { t } = useTranslation();
    const ACTIVITY_CONFIG = {
        new: {
            icon: Bell,
            color: '#3B82F6',
            bg: 'from-blue-500/20 to-blue-600/5',
            label: t('common.new') || 'جديد',
        },
        complete: {
            icon: CheckCircle,
            color: '#10B981',
            bg: 'from-emerald-500/20 to-emerald-600/5',
            label: t('common.completed') || 'مكتمل',
        },
        delay: {
            icon: AlertTriangle,
            color: '#F59E0B',
            bg: 'from-amber-500/20 to-amber-600/5',
            label: t('common.delayed') || 'تأخير',
        },
        points: {
            icon: Star,
            color: '#8B5CF6',
            bg: 'from-purple-500/20 to-purple-600/5',
            label: t('common.points') || 'نقاط',
        },
        alert: {
            icon: AlertTriangle,
            color: '#EF4444',
            bg: 'from-red-500/20 to-red-600/5',
            label: t('common.warning') || 'تنبيه',
        },
    };
    const [displayedActivities, setDisplayedActivities] = useState<ActivityItem[]>([]);
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const newActivity = activities.filter(
            a => !displayedActivities.find(d => d.id === a.id)
        );

        if (newActivity.length > 0) {
            setNewIds(new Set(newActivity.map(a => a.id)));

            // Clear new flag after animation
            setTimeout(() => setNewIds(new Set()), 1000);
        }

        setDisplayedActivities(activities.slice(0, maxItems));

        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = 0;
        }
    }, [activities, maxItems, autoScroll]);

    const stats = {
        total: displayedActivities.length,
        completed: displayedActivities.filter(a => a.type === 'complete').length,
        delayed: displayedActivities.filter(a => a.type === 'delay').length,
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-lg">
            {/* Header */}
            <div className="p-6 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Bell className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                            <div className="flex items-center gap-3 text-sm text-white/50">
                                <span>{stats.total} نشاط</span>
                                <span className="text-emerald-400">✓ {stats.completed}</span>
                                {stats.delayed > 0 && (
                                    <span className="text-amber-400">⚠ {stats.delayed}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white/70 transition-colors">
                        عرض الكل
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Activity List */}
            <div
                ref={containerRef}
                className="p-4 space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar"
            >
                {displayedActivities.length === 0 ? (
                    <div className="text-center py-12 text-white/40">
                        <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>لا توجد أنشطة حالياً</p>
                    </div>
                ) : (
                    displayedActivities.map((activity, index) => (
                        <ActivityItemComponent
                            key={activity.id}
                            activity={activity}
                            isNew={newIds.has(activity.id)}
                            index={index}
                        />
                    ))
                )}
            </div>

            {/* Styles */}
            <style>{`
                @keyframes slide-border {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); opacity: 0; }
                }
                @keyframes pulse-once {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.01); }
                }
                .animate-pulse-once {
                    animation: pulse-once 0.5s ease-out;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.05);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    );
};

export default ActivityFeed;
