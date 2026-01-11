/**
 * Global Services Provider
 * Initializes and provides global services across the app
 * Adora Hotel Management System V2
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

// Import services
import { initOfflineSync, cleanupOfflineSync, useOfflineSync } from '../../services/offlineSyncService';
import { startOverdueMonitoring, stopOverdueMonitoring, useOverdueAlerts, OverdueRequest } from '../../services/overdueAlertService';
import { startLiveTimers, stopLiveTimers } from '../../services/liveTimerService';
import { startPendingAlerts, stopPendingAlerts, usePendingAlerts, requestNotificationPermission, PendingRequest } from '../../services/pendingAlertService';
import { startAutoTransfer, stopAutoTransfer } from '../../services/autoTransferService';
import { BackupScheduler } from '../common/BackupScheduler';
import { LicenseNotificationScheduler } from '../common/LicenseNotificationScheduler';

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
    });

    // Initialize pending alerts
    const { pendingRequests, pendingCount, urgentCount, toggleAlerts, toggleSound } = usePendingAlerts(
        branch,
        department,
        { enabled: alertsEnabled, soundEnabled }
    );

    // Initialize services on mount
    useEffect(() => {
        // Initialize offline sync
        initOfflineSync();

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
                const { db } = await import('../../services/firebase');

                const settingsRef = doc(db, `tenants/${user.tenantId}/branches/${branch}/settings`, 'system');
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
                    await startAutoTransfer(branch, user.tenantId);
                } catch (err) {
                    console.warn('Failed to start auto-transfer service:', err);
                }
            } catch (error) {
                console.error('Error loading system settings:', error);
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

            {/* Offline indicator */}
            {!online && <OfflineIndicator pendingCount={pendingOps} />}

            {/* Global CSS for animations */}
            <style>{globalStyles}</style>
        </GlobalServicesContext.Provider>
    );
};

// ============================================================
// OFFLINE INDICATOR
// ============================================================

const OfflineIndicator: React.FC<{ pendingCount: number }> = ({ pendingCount }) => (
    <div
        style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            padding: '12px 20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #EF4444, #DC2626)',
            color: 'white',
            fontWeight: 500,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
        }}
    >
        <span style={{ fontSize: '1.2rem' }}>📴</span>
        <div>
            <div>غير متصل</div>
            {pendingCount > 0 && (
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                    {pendingCount} عملية معلقة
                </div>
            )}
        </div>
    </div>
);

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
