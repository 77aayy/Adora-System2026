/**
 * Manager Announcement Banner
 * Displays urgent announcements from manager to all departments
 * Appears as scrolling ticker at the top of department dashboards
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Zap, Droplet, Wrench, Info, Bell, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
    subscribeToManagerAnnouncements,
    markManagerAnnouncementAsViewed,
    dismissManagerAnnouncement,
    type ManagerAnnouncement
} from '../../services/managerAnnouncementService';
import { ADORA_THEME } from '../../design/adoraTheme';

interface ManagerAnnouncementBannerProps {
    department: string; // Current department (reception, housekeeping, etc.)
}

export const ManagerAnnouncementBanner: React.FC<ManagerAnnouncementBannerProps> = ({ department }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { tenantId: contextTenantId } = useTenant();
    // ✅ FIX: Use user.tenantId as fallback if context tenantId is null
    const tenantId = contextTenantId || (user as any)?.tenantId || null;
    const branchId = (user as any)?.branchId || (user as any)?.branch;

    const [announcements, setAnnouncements] = useState<ManagerAnnouncement[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const viewedIdsRef = useRef<Set<string>>(new Set());
    const dismissedIdsRef = useRef<Set<string>>(new Set());

    // Load dismissed IDs from localStorage on mount
    useEffect(() => {
        if (!tenantId || !user?.id) return;
        const saved = localStorage.getItem(`manager_announcements_dismissed_${tenantId}_${user.id}`);
        if (saved) {
            try {
                const parsed = new Set(JSON.parse(saved));
                setDismissedIds(parsed);
                dismissedIdsRef.current = parsed;
            } catch (e) {
                console.error('Error loading dismissed announcements:', e);
            }
        }
    }, [tenantId, user?.id]);

    // ✅ FIX: Subscribe to announcements ONCE (no re-subscription on state changes)
    useEffect(() => {
        if (!tenantId || !user?.id || !department) {
            setAnnouncements([]); // Clear announcements if missing data
            return;
        }

        const unsubscribe = subscribeToManagerAnnouncements(
            tenantId,
            department,
            branchId,
            (announcementsList) => {
                // Filter out dismissed announcements using ref (no dependency)
                const active = announcementsList.filter(a => !dismissedIdsRef.current.has(a.id));
                setAnnouncements(active);

                // Mark as viewed for new announcements (using ref to avoid re-subscription)
                active.forEach(announcement => {
                    if (!viewedIdsRef.current.has(announcement.id)) {
                        markManagerAnnouncementAsViewed(
                            tenantId,
                            announcement.id,
                            user.id,
                            user.name || t('common.employee') || 'موظف',
                            department,
                            branchId
                        );
                        viewedIdsRef.current.add(announcement.id);
                    }
                });
            }
        );

        return () => unsubscribe();
    }, [tenantId, branchId, user?.id, department]); // ✅ FIX: Removed dismissedIds and viewedIds from dependencies

    // ✅ FIX: Auto-rotate announcements (stable duration)
    useEffect(() => {
        if (announcements.length <= 1) {
            setCurrentIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % announcements.length);
        }, 8000); // 8 seconds for better UX

        return () => clearInterval(interval);
    }, [announcements.length]);


    const handleDismiss = async (announcementId: string) => {
        if (!user?.id || !tenantId) return;

        try {
            // ✅ FIX: Record dismissal in Firestore (for manager audit log)
            await dismissManagerAnnouncement(
                tenantId,
                announcementId,
                user.id,
                user.name || 'موظف',
                department,
                branchId
            );

            // ✅ FIX: Hide announcement from THIS employee only (not from all employees)
            const newDismissed = new Set(dismissedIds).add(announcementId);
            setDismissedIds(newDismissed);
            dismissedIdsRef.current = newDismissed; // Update ref to prevent re-subscription
            localStorage.setItem(
                `manager_announcements_dismissed_${tenantId}_${user.id}`,
                JSON.stringify(Array.from(newDismissed))
            );

            // ✅ FIX: Filter announcements (don't remove from state, just filter)
            // The announcement will still be in the subscription, but filtered out for this employee
            setAnnouncements(prev => {
                const filtered = prev.filter(a => !dismissedIdsRef.current.has(a.id));
                if (currentIndex >= filtered.length && filtered.length > 0) {
                    setCurrentIndex(0);
                } else if (filtered.length === 0) {
                    setCurrentIndex(0);
                }
                return filtered;
            });
        } catch (error) {
            console.error('Error dismissing announcement:', error);
        }
    };

    if (announcements.length === 0) {
        return null;
    }

    const currentAnnouncement = announcements[currentIndex];
    if (!currentAnnouncement) {
        return null;
    }

    const getTypeIcon = () => {
        switch (currentAnnouncement.type) {
            case 'power_outage':
                return <Zap className="w-5 h-5" />;
            case 'water_outage':
                return <Droplet className="w-5 h-5" />;
            case 'maintenance_alert':
                return <Wrench className="w-5 h-5" />;
            case 'urgent':
                return <AlertCircle className="w-5 h-5" />;
            case 'system_update':
                return <Bell className="w-5 h-5" />;
            default:
                return <Info className="w-5 h-5" />;
        }
    };

    // ✅ FIX: ADORA Turquoise DNA Theme Colors
    const getTypeColor = () => {
        switch (currentAnnouncement.priority) {
            case 'critical':
                return {
                    background: `linear-gradient(135deg, ${ADORA_THEME.colors.primary}E6, ${ADORA_THEME.colors.primary}CC)`,
                    border: ADORA_THEME.colors.primary,
                    text: ADORA_THEME.colors.surface,
                    shadow: `0 4px 20px ${ADORA_THEME.colors.primary}40`
                };
            case 'high':
                return {
                    background: `linear-gradient(135deg, ${ADORA_THEME.colors.primary}D9, ${ADORA_THEME.colors.primary}B3)`,
                    border: ADORA_THEME.colors.primary,
                    text: ADORA_THEME.colors.surface,
                    shadow: `0 4px 20px ${ADORA_THEME.colors.primary}33`
                };
            case 'medium':
                return {
                    background: `linear-gradient(135deg, ${ADORA_THEME.colors.primary}CC, ${ADORA_THEME.colors.primary}99)`,
                    border: ADORA_THEME.colors.primary,
                    text: ADORA_THEME.colors.surface,
                    shadow: `0 4px 20px ${ADORA_THEME.colors.primary}26`
                };
            default:
                return {
                    background: `linear-gradient(135deg, ${ADORA_THEME.colors.primary}B3, ${ADORA_THEME.colors.primary}80)`,
                    border: ADORA_THEME.colors.primary,
                    text: ADORA_THEME.colors.surface,
                    shadow: `0 4px 20px ${ADORA_THEME.colors.primary}1A`
                };
        }
    };

    const typeColor = getTypeColor();

    return (
        <div className="w-full mb-3 sm:mb-4 px-4 sm:px-6">
            <div 
                className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                    background: typeColor.background,
                    border: `2px solid ${typeColor.border}`,
                    boxShadow: typeColor.shadow,
                    backdropFilter: 'blur(10px)',
                }}
            >
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5" style={{ color: typeColor.text }}>
                    {/* Icon and Message */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                            {/* ✅ FIX: Removed animate-bounce (was annoying) */}
                            {getTypeIcon()}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span 
                                    className="font-bold text-sm sm:text-base whitespace-nowrap"
                                    style={{ color: typeColor.text }}
                                >
                                    {currentAnnouncement.titleAr || currentAnnouncement.title}:
                                </span>
                                <span 
                                    className="text-sm sm:text-base"
                                    style={{ color: typeColor.text }}
                                >
                                    {currentAnnouncement.messageAr || currentAnnouncement.message}
                                    {currentAnnouncement.scheduledTime && (
                                        <span className="font-bold mr-2">
                                            - {t('announcements.scheduledTime') || 'الوقت'}: {currentAnnouncement.scheduledTime}
                                        </span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Indicators */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Multiple announcements indicator */}
                        {announcements.length > 1 && (
                            <div 
                                className="flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                                style={{ background: 'rgba(255, 255, 255, 0.2)' }}
                            >
                                {announcements.map((_, idx) => (
                                    <div
                                        key={idx}
                                        className="w-1.5 h-1.5 rounded-full transition-all"
                                        style={{
                                            background: idx === currentIndex ? 'white' : 'rgba(255, 255, 255, 0.4)'
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Dismiss button */}
                        {currentAnnouncement.dismissible && (
                            <button
                                onClick={() => handleDismiss(currentAnnouncement.id)}
                                className="p-1.5 rounded-lg transition-colors flex-shrink-0 hover:opacity-80"
                                style={{ 
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    color: typeColor.text
                                }}
                                title={t('common.close') || 'إغلاق'}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* ✅ FIX: Progress bar for auto-rotation (matches 8s interval) */}
                {announcements.length > 1 && (
                    <div 
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ background: 'rgba(255, 255, 255, 0.2)' }}
                    >
                        <div
                            className="h-full transition-all"
                            style={{
                                width: `${((currentIndex + 1) / announcements.length) * 100}%`,
                                background: ADORA_THEME.colors.surface,
                                transitionDuration: '8s',
                                transitionTimingFunction: 'linear'
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
