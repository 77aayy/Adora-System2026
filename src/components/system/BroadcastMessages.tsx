/**
 * Broadcast Messages Component
 * Displays system-wide broadcast messages to users
 */

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { getActiveBroadcasts } from '../../services/systemSettingsService';
import { useAuth } from '../../context/AuthContext';
import type { SystemSettings } from '../../services/systemSettingsService';

export const BroadcastMessages: React.FC = () => {
    const { user } = useAuth();
    const [broadcasts, setBroadcasts] = useState<SystemSettings['broadcastMessages']>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user?.tenantId) return;
        
        let mounted = true;
        
        const loadBroadcasts = async () => {
            try {
                const active = await getActiveBroadcasts(user.tenantId);
                if (!mounted) return; // ✅ Don't update if unmounted
                setBroadcasts(active);
            } catch (error) {
                // ✅ Silently fail - don't block the app
                console.debug('Error loading broadcasts (ignored):', error);
            }
        };

        loadBroadcasts();
        const interval = setInterval(loadBroadcasts, 60000); // Check every minute

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [user?.tenantId]);

    const handleDismiss = (id: string) => {
        setDismissed(prev => new Set(prev).add(id));
        // Save to localStorage
        const dismissedIds = JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]');
        dismissedIds.push(id);
        localStorage.setItem('dismissed_broadcasts', JSON.stringify(dismissedIds));
    };

    // Load dismissed from localStorage
    useEffect(() => {
        const dismissedIds = JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]');
        setDismissed(new Set(dismissedIds));
    }, []);

    const visibleBroadcasts = broadcasts.filter(b => !dismissed.has(b.id));

    if (visibleBroadcasts.length === 0) {
        return null;
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'error':
                return <AlertCircle className="w-5 h-5" />;
            case 'warning':
                return <AlertTriangle className="w-5 h-5" />;
            case 'success':
                return <CheckCircle className="w-5 h-5" />;
            default:
                return <Info className="w-5 h-5" />;
        }
    };

    const getColorClasses = (type: string) => {
        switch (type) {
            case 'error':
                return 'bg-red-500/20 border-red-500/50 text-red-400';
            case 'warning':
                return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
            case 'success':
                return 'bg-green-500/20 border-green-500/50 text-green-400';
            default:
                return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
        }
    };

    return (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-2xl w-full mx-4 space-y-3">
            {visibleBroadcasts.map(broadcast => (
                <div
                    key={broadcast.id}
                    className={`glass rounded-xl p-4 border-l-4 ${getColorClasses(broadcast.type)} flex items-start gap-3 animate-slide-down`}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {getIcon(broadcast.type)}
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-white mb-1">{broadcast.title}</h4>
                        <p className="text-sm text-white/80">{broadcast.message}</p>
                    </div>
                    <button
                        onClick={() => handleDismiss(broadcast.id)}
                        className="flex-shrink-0 text-white/60 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};
