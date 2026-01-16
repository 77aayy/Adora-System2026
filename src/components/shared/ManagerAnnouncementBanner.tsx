/**
 * Manager Announcement Banner
 * Displays urgent announcements from manager to all departments
 * Appears as scrolling ticker at the top of department dashboards
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Zap, Droplet, Wrench, Info, Bell, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // ✅ FIX: Add i18n support
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
    subscribeToManagerAnnouncements,
    markManagerAnnouncementAsViewed,
    dismissManagerAnnouncement,
    type ManagerAnnouncement
} from '../../services/managerAnnouncementService';

interface ManagerAnnouncementBannerProps {
    department: string; // Current department (reception, housekeeping, etc.)
}

export const ManagerAnnouncementBanner: React.FC<ManagerAnnouncementBannerProps> = ({ department }) => {
    const { t } = useTranslation(); // ✅ FIX: Add i18n support
    const { user } = useAuth();
    const { tenantId } = useTenant();
    const branchId = (user as any)?.branchId || (user as any)?.branch;

    const [announcements, setAnnouncements] = useState<ManagerAnnouncement[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!tenantId || !user?.id || !department) return;

        const unsubscribe = subscribeToManagerAnnouncements(
            tenantId,
            department,
            branchId,
            (announcementsList) => {
                // Filter out dismissed announcements
                const active = announcementsList.filter(a => !dismissedIds.has(a.id));
                setAnnouncements(active);

                // Mark as viewed for new announcements
                active.forEach(announcement => {
                    if (!viewedIds.has(announcement.id)) {
                        markManagerAnnouncementAsViewed(
                            tenantId,
                            announcement.id,
                            user.id,
                            user.name || t('common.employee') || 'موظف',
                            department,
                            branchId
                        );
                        setViewedIds(prev => new Set(prev).add(announcement.id));
                    }
                });
            }
        );

        return () => unsubscribe();
    }, [tenantId, branchId, user?.id, department, dismissedIds, viewedIds]);

    // ✅ FIX: Auto-rotate announcements (increased duration to prevent rapid disappearance)
    useEffect(() => {
        if (announcements.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % announcements.length);
        }, 12000); // ✅ FIX: Changed from 5 seconds to 12 seconds (prevents rapid disappearance)

        return () => clearInterval(interval);
    }, [announcements.length]);

    // Load dismissed IDs from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`manager_announcements_dismissed_${tenantId}_${user?.id}`);
        if (saved) {
            try {
                setDismissedIds(new Set(JSON.parse(saved)));
            } catch (e) {
                console.error('Error loading dismissed announcements:', e);
            }
        }
    }, [tenantId, user?.id]);

    const handleDismiss = async (announcementId: string) => {
        if (!user?.id || !tenantId) return;

        try {
            await dismissManagerAnnouncement(
                tenantId,
                announcementId,
                user.id,
                user.name || 'موظف',
                department,
                branchId
            );

            const newDismissed = new Set(dismissedIds).add(announcementId);
            setDismissedIds(newDismissed);
            localStorage.setItem(
                `manager_announcements_dismissed_${tenantId}_${user.id}`,
                JSON.stringify(Array.from(newDismissed))
            );

            // Remove from announcements
            setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
            if (currentIndex >= announcements.length - 1) {
                setCurrentIndex(0);
            }
        } catch (error) {
            console.error('Error dismissing announcement:', error);
        }
    };

    if (announcements.length === 0) return null;

    const currentAnnouncement = announcements[currentIndex];
    if (!currentAnnouncement) return null;

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

    // ✅ FIX: Theme-aware colors using CSS variables (no hardcoded colors per Adora Rules)
    const getTypeColor = () => {
        // ✅ Use CSS variables from theme system (defined in adora-components.css)
        switch (currentAnnouncement.priority) {
            case 'critical':
                return {
                    background: 'linear-gradient(135deg, var(--adora-emergency, #ef4444), #b91c1c)',
                    border: 'var(--adora-emergency, #ef4444)',
                    text: 'white'
                };
            case 'high':
                return {
                    background: 'linear-gradient(135deg, var(--adora-maintenance, #f97316), #c2410c)',
                    border: 'var(--adora-maintenance, #f97316)',
                    text: 'white'
                };
            case 'medium':
                return {
                    background: 'linear-gradient(135deg, var(--adora-pending, #eab308), #b45309)',
                    border: 'var(--adora-pending, #eab308)',
                    text: 'white'
                };
            default:
                return {
                    background: 'linear-gradient(135deg, var(--adora-confirmed, #3b82f6), #1d4ed8)',
                    border: 'var(--adora-confirmed, #3b82f6)',
                    text: 'white'
                };
        }
    };

    const typeColor = getTypeColor();

    return (
        <div className="w-full mb-3 sm:mb-4">
            <div 
                className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg transition-all duration-300"
                style={{
                    background: typeColor.background,
                    border: `2px solid ${typeColor.border}`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
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

            {/* ✅ FIX: Progress bar for auto-rotation (updated duration to match 12s interval) */}
            {announcements.length > 1 && (
                <div 
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: 'rgba(255, 255, 255, 0.3)' }}
                >
                    <div
                        className="h-full transition-all"
                        style={{
                            width: `${((currentIndex + 1) / announcements.length) * 100}%`,
                            background: 'white',
                            transitionDuration: '12s', // ✅ FIX: Match the 12s rotation interval
                            transitionTimingFunction: 'linear'
                        }}
                    />
                </div>
            )}
        </div>
    );
};
