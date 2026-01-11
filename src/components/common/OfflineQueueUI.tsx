/**
 * Offline Queue UI Component
 * Shows pending offline actions and sync status
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, Check, AlertTriangle, WifiOff } from 'lucide-react';
import { AdoraLoaderInline } from './AdoraLoader';
import {
    isOnline,
    getQueuedActions,
    processQueue,
    clearQueue,
    type QueuedAction
} from '../../utils/connectivityMonitor';

// ============================================================
// OFFLINE STATUS INDICATOR
// ============================================================

export const OfflineIndicator: React.FC = () => {
    const [online, setOnline] = useState(isOnline());
    const [queueCount, setQueueCount] = useState(0);

    useEffect(() => {
        const handleOnline = () => {
            setOnline(true);
            // Auto-process queue when back online
            processQueue().then(() => {
                setQueueCount(getQueuedActions().length);
            });
        };

        const handleOffline = () => setOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Update queue count periodically
        const interval = setInterval(() => {
            setQueueCount(getQueuedActions().length);
        }, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    if (online && queueCount === 0) return null;

    return (
        <div className={`
            fixed bottom-20 left-4 z-50 px-4 py-2 rounded-xl flex items-center gap-2
            ${online
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }
        `}>
            {online ? (
                <>
                    <AdoraLoaderInline size={16} />
                    <span className="text-sm">{queueCount} إجراء في الانتظار</span>
                </>
            ) : (
                <>
                    <WifiOff className="w-4 h-4" />
                    <span className="text-sm">غير متصل</span>
                    {queueCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs">
                            {queueCount}
                        </span>
                    )}
                </>
            )}
        </div>
    );
};

// ============================================================
// OFFLINE QUEUE PANEL
// ============================================================

interface OfflineQueuePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const OfflineQueuePanel: React.FC<OfflineQueuePanelProps> = ({ isOpen, onClose }) => {
    const [actions, setActions] = useState<QueuedAction[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [online, setOnline] = useState(isOnline());

    useEffect(() => {
        setActions(getQueuedActions());
        setOnline(isOnline());

        const handleOnline = () => setOnline(true);
        const handleOffline = () => setOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [isOpen]);

    const handleSync = async () => {
        if (!online) return;

        setSyncing(true);
        await processQueue();
        setActions(getQueuedActions());
        setSyncing(false);
    };

    const handleClear = () => {
        if (confirm('هل أنت متأكد من حذف جميع الإجراءات المعلقة؟')) {
            clearQueue();
            setActions([]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} style={{ backdropFilter: 'none' }} />

            <div className="relative w-full max-w-md glass rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {online ? (
                            <Cloud className="w-6 h-6 text-green-400" />
                        ) : (
                            <CloudOff className="w-6 h-6 text-red-400" />
                        )}
                        <div>
                            <h3 className="text-lg font-bold text-white">قائمة الانتظار</h3>
                            <p className="text-sm text-white/80"> {/* ✅ Improved contrast (was 50%) */}
                                {online ? 'متصل بالإنترنت' : 'غير متصل'}
                            </p>
                        </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-400">
                        {actions.length}
                    </span>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {actions.length === 0 ? (
                        <div className="text-center py-8">
                            <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
                            <p className="text-white/80">لا توجد إجراءات معلقة</p> {/* ✅ Improved contrast (was 50%) */}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {actions.map((action, index) => (
                                <div
                                    key={index}
                                    className="p-3 rounded-xl bg-white/5 border border-white/10"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-white font-medium">
                                            {action.type}
                                        </span>
                                        <span className="text-xs text-white/70"> {/* ✅ Improved contrast (was 40%) */}
                                            {new Date(action.timestamp).toLocaleTimeString('ar-SA')}
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/80 truncate"> {/* ✅ Improved contrast (was 50%) */}
                                        {JSON.stringify(action.data).substring(0, 50)}...
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {actions.length > 0 && (
                    <div className="p-4 border-t border-white/10 flex gap-2">
                        <button
                            onClick={handleSync}
                            disabled={!online || syncing}
                            className="btn-primary flex-1"
                        >
                            {syncing ? (
                                <AdoraLoaderInline size={20} />
                            ) : (
                                <>
                                    <Cloud className="w-5 h-5" />
                                    مزامنة
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleClear}
                            className="btn-danger"
                        >
                            <AlertTriangle className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OfflineIndicator;
