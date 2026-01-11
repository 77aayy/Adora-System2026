/**
 * Maintenance Mode Component
 * Displays maintenance mode screen when system is under maintenance
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { isMaintenanceMode } from '../../services/systemSettingsService';

export const MaintenanceMode: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [maintenance, setMaintenance] = useState<{ enabled: boolean; message?: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        
        const checkMaintenance = async () => {
            try {
                const status = await isMaintenanceMode();
                if (!mounted) return; // ✅ Don't update if unmounted
                setMaintenance(status);
            } catch (error) {
                // ✅ Silently fail - don't block the app
                console.debug('Error checking maintenance mode (ignored):', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        checkMaintenance();
        const interval = setInterval(checkMaintenance, 30000); // Check every 30 seconds

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    if (loading) {
        return <div>{children}</div>;
    }

    if (maintenance?.enabled) {
        return (
            <div className="min-h-screen flex items-center justify-center theme-page p-4">
                <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                        <AlertTriangle className="w-10 h-10 text-yellow-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-4">النظام تحت الصيانة</h1>
                    <p className="text-white/60 mb-6">{maintenance.message || 'نظامنا تحت الصيانة. سنعود قريباً.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-yellow-500/20 text-yellow-400 rounded-xl hover:bg-yellow-500/30 transition-colors inline-flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>تحديث الصفحة</span>
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
