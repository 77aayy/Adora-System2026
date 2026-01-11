/**
 * Manager Announcement Banner
 * Displays urgent announcements from manager to all departments
 * Appears as scrolling ticker at the top of department dashboards
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Zap, Droplet, Wrench, Info, Bell, ChevronRight } from 'lucide-react';
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
                            user.name || 'موظف',
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

    // Auto-rotate announcements
    useEffect(() => {
        if (announcements.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % announcements.length);
        }, 5000); // Change every 5 seconds

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

    const getTypeColor = () => {
        switch (currentAnnouncement.priority) {
            case 'critical':
                return 'bg-red-600 border-red-500';
            case 'high':
                return 'bg-orange-600 border-orange-500';
            case 'medium':
                return 'bg-yellow-600 border-yellow-500';
            default:
                return 'bg-blue-600 border-blue-500';
        }
    };

    return (
        <div className={`relative w-full ${getTypeColor()} border-b-2 shadow-lg animate-pulse`}>
            <div className="flex items-center justify-between px-4 py-3 text-white">
                {/* Icon and Message */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 animate-bounce">
                        {getTypeIcon()}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm sm:text-base whitespace-nowrap">
                                {currentAnnouncement.titleAr || currentAnnouncement.title}:
                            </span>
                            <span className="text-sm sm:text-base">
                                {currentAnnouncement.messageAr || currentAnnouncement.message}
                                {currentAnnouncement.scheduledTime && (
                                    <span className="font-bold mr-2">- الوقت: {currentAnnouncement.scheduledTime}</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Indicators */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Multiple announcements indicator */}
                    {announcements.length > 1 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/20">
                            {announcements.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                        idx === currentIndex ? 'bg-white' : 'bg-white/40'
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Dismiss button */}
                    {currentAnnouncement.dismissible && (
                        <button
                            onClick={() => handleDismiss(currentAnnouncement.id)}
                            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
                            title="إغلاق"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar for auto-rotation */}
            {announcements.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30">
                    <div
                        className="h-full bg-white transition-all duration-5000"
                        style={{
                            width: `${((currentIndex + 1) / announcements.length) * 100}%`
                        }}
                    />
                </div>
            )}
        </div>
    );
};
