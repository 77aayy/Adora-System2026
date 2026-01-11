/**
 * Update Notifications Component
 * Displays system update notifications to users
 */

import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, Download } from 'lucide-react';
import { getSystemSettings } from '../../services/systemSettingsService';
import type { SystemSettings } from '../../services/systemSettingsService';

export const UpdateNotifications: React.FC = () => {
    const [updates, setUpdates] = useState<SystemSettings['updates']>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());

    useEffect(() => {
        let mounted = true;
        
        const loadUpdates = async () => {
            try {
                const settings = await getSystemSettings();
                if (!mounted) return; // ✅ Don't update if unmounted
                
                const now = new Date();
                
                // Filter updates from last 30 days
                const recentUpdates = settings.updates.filter(update => {
                    const releaseDate = new Date(update.releaseDate);
                    const daysDiff = (now.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
                    return daysDiff <= 30;
                });
                
                setUpdates(recentUpdates);
            } catch (error) {
                // ✅ Silently fail - don't block the app
                console.debug('Error loading updates (ignored):', error);
            }
        };

        loadUpdates();
        const interval = setInterval(loadUpdates, 3600000); // Check every hour

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    // Load dismissed/acknowledged from localStorage
    useEffect(() => {
        const dismissedIds = JSON.parse(localStorage.getItem('dismissed_updates') || '[]');
        const acknowledgedIds = JSON.parse(localStorage.getItem('acknowledged_updates') || '[]');
        setDismissed(new Set(dismissedIds));
        setAcknowledged(new Set(acknowledgedIds));
    }, []);

    const handleDismiss = (version: string) => {
        setDismissed(prev => new Set(prev).add(version));
        const dismissedIds = JSON.parse(localStorage.getItem('dismissed_updates') || '[]');
        dismissedIds.push(version);
        localStorage.setItem('dismissed_updates', JSON.stringify(dismissedIds));
    };

    const handleAcknowledge = (version: string) => {
        setAcknowledged(prev => new Set(prev).add(version));
        const acknowledgedIds = JSON.parse(localStorage.getItem('acknowledged_updates') || '[]');
        acknowledgedIds.push(version);
        localStorage.setItem('acknowledged_updates', JSON.stringify(acknowledgedIds));
    };

    // Filter visible updates
    const visibleUpdates = updates.filter(update => {
        if (dismissed.has(update.version)) return false;
        if (update.requiredUpdate && !acknowledged.has(update.version)) return true;
        if (!update.requiredUpdate && !dismissed.has(update.version)) return true;
        return false;
    });

    // Priority: Show required updates first, then critical, then regular
    const sortedUpdates = [...visibleUpdates].sort((a, b) => {
        if (a.requiredUpdate && !b.requiredUpdate) return -1;
        if (!a.requiredUpdate && b.requiredUpdate) return 1;
        if (a.critical && !b.critical) return -1;
        if (!a.critical && b.critical) return 1;
        return 0;
    });

    if (sortedUpdates.length === 0) {
        return null;
    }

    const latestUpdate = sortedUpdates[0];
    const isRequired = latestUpdate.requiredUpdate;

    return (
        <div className={`fixed ${isRequired ? 'inset-0 bg-black/60 z-50' : 'top-20 right-4 z-40'} flex items-center justify-center p-4`} style={isRequired ? { backdropFilter: 'none' } : {}}>
            <div className={`glass rounded-2xl p-6 ${isRequired ? 'max-w-md w-full' : 'max-w-sm w-full'} ${isRequired ? 'border-2 border-red-500/50' : ''}`}>
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        latestUpdate.critical || latestUpdate.requiredUpdate
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                    }`}>
                        {latestUpdate.requiredUpdate ? (
                            <AlertTriangle className="w-6 h-6" />
                        ) : (
                            <Bell className="w-6 h-6" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-white">تحديث جديد</h4>
                            {latestUpdate.critical && (
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                                    حرج
                                </span>
                            )}
                            {latestUpdate.requiredUpdate && (
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                                    مطلوب
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/80 mb-2">
                            <strong>الإصدار {latestUpdate.version}</strong>
                        </p>
                        <p className="text-sm text-white/60 mb-4">{latestUpdate.changelog}</p>
                        {!isRequired && (
                            <button
                                onClick={() => handleDismiss(latestUpdate.version)}
                                className="text-xs text-white/60 hover:text-white transition-colors"
                            >
                                تجاهل
                            </button>
                        )}
                        {isRequired && (
                            <button
                                onClick={() => handleAcknowledge(latestUpdate.version)}
                                className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-xl hover:bg-blue-500/30 transition-colors text-sm font-medium"
                            >
                                فهمت
                            </button>
                        )}
                    </div>
                    {!isRequired && (
                        <button
                            onClick={() => handleDismiss(latestUpdate.version)}
                            className="flex-shrink-0 text-white/60 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
