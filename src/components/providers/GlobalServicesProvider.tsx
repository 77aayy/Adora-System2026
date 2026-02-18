/**
 * Global Services Provider
 * Initializes and provides global services across the app
 * Adora Hotel Management System V2
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { WifiOff, Wifi, Cloud } from 'lucide-react';

// Import services
import { initOfflineSync, cleanupOfflineSync, useOfflineSync, onOnline } from '../../services/offlineSyncService';
import { syncOfflineCheckoutQueue } from '../../services/roomCardService';
import { startOverdueMonitoring, stopOverdueMonitoring, useOverdueAlerts, OverdueRequest } from '../../services/overdueAlertService';
import { startLiveTimers, stopLiveTimers } from '../../services/liveTimerService';
import { startPendingAlerts, stopPendingAlerts, usePendingAlerts, requestNotificationPermission, PendingRequest } from '../../services/pendingAlertService';
import { startAutoTransfer, stopAutoTransfer } from '../../services/autoTransferService';
import { BackupScheduler } from '../common/BackupScheduler';
import { LicenseNotificationScheduler } from '../common/LicenseNotificationScheduler';
import { logger } from '../../services/loggerService';

// ============================================================
// TYPES
// ============================================================

interface GlobalServicesContextType {
    // Offline
    isOnline: boolean;
    pendingOperations: number;

    // Overdue
    overdueRequests: OverdueRequest[];
    overdueWarningCount: number;
    overdueCriticalCount: number;

    // Pending Alerts
    pendingRequests: PendingRequest[];
    pendingCount: number;
    urgentCount: number;

    // Controls
    toggleAlerts: (enabled: boolean) => void;
    toggleSound: (enabled: boolean) => void;
}

const defaultContext: GlobalServicesContextType = {
    isOnline: true,
    pendingOperations: 0,
    overdueRequests: [],
    overdueWarningCount: 0,
    overdueCriticalCount: 0,
    pendingRequests: [],
    pendingCount: 0,
    urgentCount: 0,
    toggleAlerts: () => { },
    toggleSound: () => { },
};

// ============================================================
// CONTEXT
// ============================================================

const GlobalServicesContext = createContext<GlobalServicesContextType>(defaultContext);

export const useGlobalServices = () => useContext(GlobalServicesContext);

// ============================================================
// PROVIDER COMPONENT
// ============================================================

interface GlobalServicesProviderProps {
    children: ReactNode;
}

export const GlobalServicesProvider: React.FC<GlobalServicesProviderProps> = ({ children }) => {
    const { user, branchId } = useAuth();
    const [alertsEnabled, setAlertsEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Get department from user
    const branch = branchId || '';
    const department = user?.department || 'reception';

    // Initialize offline sync
    const { online, pendingCount: pendingOps } = useOfflineSync();

    // Initialize overdue monitoring
    const { overdueRequests, warningCount, criticalCount } = useOverdueAlerts(branch, {
        warningMinutes: 15,
        criticalMinutes: 30,
        tenantId: user?.tenantId
    });

    // Initialize pending alerts
    const { pendingRequests, pendingCount, urgentCount, toggleAlerts, toggleSound } = usePendingAlerts(
        branch,
        department,
        { enabled: alertsEnabled, soundEnabled, tenantId: user?.tenantId }
    );

    // Initialize services on mount
    useEffect(() => {
        // ✅ CRITICAL: Ensure Anonymous Auth FIRST before any Firestore operations
        // This is required for systemSettings and other public collections to work
        const ensureAuth = async () => {
            try {
                const { auth } = await import('../../services/firebase');
                if (auth && !auth.currentUser) {
                    try {
                        const { signInAnonymously } = await import('firebase/auth');
                        await signInAnonymously(auth);
                    } catch (authError: any) {
                        // Don't block app initialization if Anonymous Auth fails
                        // It will be retried during login
                        logger.warn('⚠️ Anonymous auth failed at startup (non-critical):', authError?.message, 'GlobalServicesProvider');
                    }
                }
            } catch (error) {
                logger.warn('⚠️ Failed to ensure Anonymous Auth at startup:', error, 'GlobalServicesProvider');
            }
        };
        
        ensureAuth();

        // Initialize offline sync
        initOfflineSync();
        // Replay room-card checkout inspection queue when back online (and once on init if online)
        const runCheckoutQueueSync = () => {
            syncOfflineCheckoutQueue().then(({ synced }) => {
                if (synced > 0) logger.info('syncOfflineCheckoutQueue synced', synced, 'GlobalServicesProvider');
            });
        };
        onOnline(runCheckoutQueueSync);
        if (navigator.onLine) runCheckoutQueueSync();

        // Start live timers
        startLiveTimers({ updateIntervalMs: 1000 });

        // Request notification permission
        requestNotificationPermission();

        // Cleanup on unmount
        return () => {
            cleanupOfflineSync();
            stopLiveTimers();
            stopOverdueMonitoring();
            stopPendingAlerts();
            stopAutoTransfer();
        };
    }, []);

    // Load system settings from Firebase and sync with services
    useEffect(() => {
        const loadSystemSettings = async () => {
            if (!user?.tenantId || !branch) return;
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const { getSafeFirestore } = await import('../../services/firebase');
                const safeDb = await getSafeFirestore();
                if (!safeDb) return; // Firestore not ready; avoid collection() invalid-arg error

                const settingsRef = doc(safeDb, 'tenants', user.tenantId, 'branches', branch, 'settings', 'system');
                const snap = await getDoc(settingsRef);

                if (snap.exists()) {
                    const data = snap.data();
                    if (data.soundEnabled !== undefined) {
                        setSoundEnabled(data.soundEnabled);
                        toggleSound(data.soundEnabled);
                    }
                }

                // Start auto-transfer service
                try {
                    if (branch && user?.tenantId) {
                        await startAutoTransfer(branch, user.tenantId);
                    }
                } catch (err) {
                    logger.warn('Failed to start auto-transfer service:', err, 'GlobalServicesProvider');
                }
            } catch (error: any) {
                const isPerm = error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient');
                if (isPerm) {
                    logger.debug('System settings read skipped (permission not yet ready)', undefined, 'GlobalServicesProvider');
                } else {
                    logger.error('Error loading system settings:', error, 'GlobalServicesProvider');
                }
            }
        };

        loadSystemSettings();
    }, [user?.tenantId, branch]);

    // Context value
    const value: GlobalServicesContextType = {
        isOnline: online,
        pendingOperations: pendingOps,
        overdueRequests,
        overdueWarningCount: warningCount,
        overdueCriticalCount: criticalCount,
        pendingRequests,
        pendingCount,
        urgentCount,
        toggleAlerts: (enabled) => {
            setAlertsEnabled(enabled);
            toggleAlerts(enabled);
        },
        toggleSound: (enabled) => {
            setSoundEnabled(enabled);
            toggleSound(enabled);
        },
    };

    return (
        <GlobalServicesContext.Provider value={value}>
            {children}

            {/* ✅ Automatic Schedulers */}
            <BackupScheduler />
            <LicenseNotificationScheduler />

            {/* ✅ Enhanced Offline indicator - Shows both offline AND pending operations */}
            {(!online || pendingOps > 0) && <OfflineIndicator online={online} pendingCount={pendingOps} />}

            {/* Global CSS for animations */}
            <style>{globalStyles}</style>
        </GlobalServicesContext.Provider>
    );
};

// ============================================================
// ✅ ENHANCED OFFLINE INDICATOR
// ============================================================

const OfflineIndicator: React.FC<{ online: boolean; pendingCount: number }> = ({ online, pendingCount }) => {
    // Don't show if online and no pending operations
    if (online && pendingCount === 0) return null;

    const isOffline = !online;
    const hasPending = pendingCount > 0;

    return (
        <div
            className={`
                fixed bottom-4 left-4 z-[9999] px-4 py-3 rounded-xl 
                flex items-center gap-3 shadow-2xl backdrop-blur-xl
                border-2 animate-fade-in-up transition-all duration-300
                ${isOffline
                    ? 'bg-gradient-to-r from-red-500/90 to-red-600/90 border-red-400/50 text-white'
                    : hasPending
                        ? 'bg-gradient-to-r from-yellow-500/90 to-amber-600/90 border-yellow-400/50 text-white'
                        : 'hidden'
                }
            `}
            style={{
                animation: 'slideInUp 0.3s ease-out',
            }}
        >
            {/* Icon */}
            <div className="relative">
                {isOffline ? (
                    <WifiOff className="w-5 h-5 animate-pulse" />
                ) : (
                    <Cloud className="w-5 h-5 animate-pulse text-yellow-300" />
                )}
            </div>

            {/* Content */}
            <div className="flex flex-col">
                <div className="text-sm font-semibold">
                    {isOffline ? 'غير متصل بالإنترنت' : 'مزامنة البيانات...'}
                </div>
                {hasPending && (
                    <div className="text-xs opacity-90 mt-0.5">
                        {pendingCount} {pendingCount === 1 ? 'عملية معلقة' : 'عمليات معلقة'}
                    </div>
                )}
            </div>

            {/* Pending Badge */}
            {hasPending && (
                <div className={`
                    px-2.5 py-1 rounded-full text-xs font-bold
                    ${isOffline
                        ? 'bg-white/20 text-white'
                        : 'bg-white/30 text-yellow-900'
                    }
                    animate-pulse
                `}>
                    {pendingCount}
                </div>
            )}

            {/* Connection Status Icon */}
            {!isOffline && hasPending && (
                <div className="ml-auto">
                    <Wifi className="w-4 h-4 text-green-300" />
                </div>
            )}
        </div>
    );
};

// ============================================================
// GLOBAL CSS
// ============================================================

const globalStyles = `
    @keyframes slideDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    
    @keyframes slideUp {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
    
    @keyframes slideIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
    
    @keyframes bounceIn {
        0% { opacity: 0; transform: translateX(-50%) scale(0.3); }
        50% { transform: translateX(-50%) scale(1.05); }
        70% { transform: translateX(-50%) scale(0.9); }
        100% { opacity: 1; transform: translateX(-50%) scale(1); }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
`;

export default GlobalServicesProvider;
