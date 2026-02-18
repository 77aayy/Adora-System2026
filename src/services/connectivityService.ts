/**
 * Connectivity Monitor Service
 * Migrated from connectivity-monitor.js
 * Adora Hotel Management System V2
 * 
 * Monitors network connectivity and Firebase connection
 */

import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type ConnectionStatus = 'online' | 'offline' | 'checking';

export interface ConnectionState {
    isOnline: boolean;
    lastChecked: Date | null;
    firebaseConnected: boolean;
}

type StatusCallback = (isOnline: boolean) => void;

// ============================================================
// CONNECTION MONITOR
// ============================================================

class ConnectivityMonitor {
    private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
    private firebaseConnected: boolean = false;
    private callbacks: StatusCallback[] = [];
    private checkInterval: NodeJS.Timeout | null = null;

    /**
     * Initialize the monitor
     */
    init(): void {
        if (typeof window === 'undefined') return;

        // Browser online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.updateUI(true);
            this.notifyCallbacks(true);
            this.checkFirebaseConnection();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.firebaseConnected = false;
            this.updateUI(false);
            this.notifyCallbacks(false);
        });

        // Initial state
        this.updateUI(this.isOnline);

        // Periodic Firebase check (every 10 seconds)
        this.checkInterval = setInterval(() => {
            if (this.isOnline) {
                this.checkFirebaseConnection();
            }
        }, 10000);

        logger.info('✅ Connectivity Monitor initialized', undefined, 'connectivityService');
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.callbacks = [];
    }

    /**
     * Check Firebase connection
     */
    async checkFirebaseConnection(): Promise<boolean> {
        try {
            // Try a simple read to test connection
            const testRef = doc(db, '_connection_test/test');
            await getDoc(testRef);

            this.firebaseConnected = true;

            if (!this.isOnline) {
                this.isOnline = true;
                this.updateUI(true);
                this.notifyCallbacks(true);
            }

            return true;
        } catch (error: any) {
            if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
                this.firebaseConnected = false;
                if (this.isOnline) {
                    // Browser says online but Firebase is not reachable
                    logger.warn('⚠️ Firebase connection lost', undefined, 'connectivityService');
                }
            }
            return false;
        }
    }

    /**
     * Update UI indicator
     */
    private updateUI(isOnline: boolean): void {
        if (typeof document === 'undefined') return;

        const statusEl = document.getElementById('connectionStatus');
        const warningEl = document.getElementById('offlineWarning');

        if (statusEl) {
            if (isOnline) {
                statusEl.innerHTML = '<span class="status-dot status-online"></span><span>متصل</span>';
                statusEl.className = 'connection-status connection-online';
                if (warningEl) warningEl.classList.add('hidden');
            } else {
                statusEl.innerHTML = '<span class="status-dot status-offline"></span><span>غير متصل</span>';
                statusEl.className = 'connection-status connection-offline';
                if (warningEl) warningEl.classList.remove('hidden');
            }
        }
    }

    /**
     * Add status change callback
     */
    onStatusChange(callback: StatusCallback): () => void {
        this.callbacks.push(callback);

        // Return unsubscribe function
        return () => {
            const index = this.callbacks.indexOf(callback);
            if (index > -1) {
                this.callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Notify all callbacks
     */
    private notifyCallbacks(isOnline: boolean): void {
        this.callbacks.forEach(cb => {
            try {
                cb(isOnline);
            } catch (e) {
                logger.error('Connectivity callback error:', e, 'connectivityService');
            }
        });
    }

    /**
     * Get current status
     */
    getStatus(): ConnectionState {
        return {
            isOnline: this.isOnline,
            lastChecked: new Date(),
            firebaseConnected: this.firebaseConnected
        };
    }

    /**
     * Check if online
     */
    get online(): boolean {
        return this.isOnline;
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const connectivityMonitor = new ConnectivityMonitor();

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

interface UseConnectivityReturn {
    isOnline: boolean;
    firebaseConnected: boolean;
    checkConnection: () => Promise<boolean>;
}

export const useConnectivity = (): UseConnectivityReturn => {
    const [isOnline, setIsOnline] = useState(connectivityMonitor.online);
    const [firebaseConnected, setFirebaseConnected] = useState(false);

    useEffect(() => {
        // Subscribe to status changes
        const unsubscribe = connectivityMonitor.onStatusChange((online) => {
            setIsOnline(online);
        });

        // Check Firebase on mount
        connectivityMonitor.checkFirebaseConnection().then(setFirebaseConnected);

        return () => unsubscribe();
    }, []);

    const checkConnection = useCallback(async () => {
        const result = await connectivityMonitor.checkFirebaseConnection();
        setFirebaseConnected(result);
        return result;
    }, []);

    return {
        isOnline,
        firebaseConnected,
        checkConnection
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    connectivityMonitor,
    useConnectivity
};
