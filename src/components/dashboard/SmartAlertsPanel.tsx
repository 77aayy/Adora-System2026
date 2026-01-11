/**
 * Smart Alerts Panel Component
 * Real-time intelligent alerts for management
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, RefreshCw, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoader, AdoraLoaderInline } from '../common/AdoraLoader';
import {
    SmartAlert,
    getSmartAlerts,
    getAlertIcon,
    getSeverityColor
} from '../../services/smartAlertsService';

// ============================================================
// MAIN COMPONENT
// ============================================================

export const SmartAlertsPanel: React.FC = () => {
    const { user, branchId: contextBranchId } = useAuth();
    const branchId = contextBranchId || (user as any)?.branchId || (user as any)?.branch;
    const tenantId = (user as any)?.tenantId;

    const [alerts, setAlerts] = useState<SmartAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(false);

    // Persistent Dismissed IDs via localStorage
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem(`adora_dismissed_alerts_${branchId}`);
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    // Sync dismissed IDs to localStorage
    useEffect(() => {
        if (branchId) {
            localStorage.setItem(`adora_dismissed_alerts_${branchId}`, JSON.stringify(Array.from(dismissedIds)));
        }
    }, [dismissedIds, branchId]);

    // Load alerts
    const loadAlerts = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const data = await getSmartAlerts(branchId, tenantId);
            setAlerts(data.filter(a => !dismissedIds.has(a.id)));
        } catch (err) {
            console.error('Error loading alerts:', err);
        }
        setLoading(false);
    }, [branchId, tenantId, dismissedIds]);

    useEffect(() => {
        if (branchId) {
            loadAlerts();
            const interval = setInterval(loadAlerts, 120000);
            return () => clearInterval(interval);
        }
    }, [loadAlerts, branchId]);

    // Dismiss alert
    const dismissAlert = (id: string) => {
        setDismissedIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setAlerts(prev => prev.filter(a => a.id !== id));
    };

    // Count by severity
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const warningCount = alerts.filter(a => a.severity === 'warning').length;

    // Show only critical/warning alerts (not info)
    const activeAlerts = alerts.filter(a => a.severity !== 'info');
    const displayAlerts = expanded ? activeAlerts : activeAlerts.slice(0, 3);

    if (loading && alerts.length === 0) {
        return (
            <div className="p-4 transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--theme-border-primary)' }}>
                <div className="flex items-center gap-3">
                    <AdoraLoaderInline size={20} />
                    <span className="transition-colors duration-300" style={{ color: 'var(--theme-text-secondary)' }}>جاري تحميل التنبيهات...</span>
                </div>
            </div>
        );
    }

    if (activeAlerts.length === 0) {
        return (
            <div className="p-4 transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--theme-border-primary)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                        <p className="font-medium transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>لا توجد تنبيهات</p>
                        <p className="text-sm transition-colors duration-300" style={{ color: 'var(--theme-text-secondary)' }}>كل شيء يسير بشكل طبيعي</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="smart-alerts-panel" className="overflow-hidden transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--theme-border-primary)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)' }}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${criticalCount > 0 ? 'bg-red-500/20' : 'bg-yellow-500/20'
                        }`}>
                        <Bell className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-400' : 'text-yellow-400'
                            }`} />
                    </div>
                    <div>
                        <h4 className="font-semibold transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>التنبيهات الذكية</h4>
                        <p className="text-sm transition-colors duration-300" style={{ color: 'var(--theme-text-secondary)' }}>
                            {criticalCount > 0 && (
                                <span className="text-red-400 mr-2">🔴 {criticalCount} حرج</span>
                            )}
                            {warningCount > 0 && (
                                <span className="text-yellow-400">🟡 {warningCount} تحذير</span>
                            )}
                        </p>
                    </div>
                </div>
                <button
                    onClick={loadAlerts}
                    disabled={loading}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300"
                    style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-text-secondary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-text-secondary)'; }}
                >
                    {loading ? <AdoraLoaderInline size={16} /> : <RefreshCw className="w-4 h-4" />}
                </button>
            </div>

            {/* Alerts List */}
            <div className="divide-y transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)' }}>
                {displayAlerts.map(alert => (
                    <div
                        key={alert.id}
                        className={`p-3 flex items-start gap-3 transition-colors duration-300 ${alert.severity === 'critical' ? 'bg-red-500/5' : 'bg-yellow-500/5'
                            }`}
                    >
                        <div className={`text-xl flex-shrink-0`}>
                            {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${getSeverityColor(alert.severity)}`}>
                                    {alert.severity === 'critical' ? 'حرج' : 'تحذير'}
                                </span>
                                <span className="text-sm font-medium truncate transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{alert.title}</span>
                            </div>
                            <p className="text-sm mt-0.5 transition-colors duration-300" style={{ color: 'var(--theme-text-secondary)' }}>{alert.message}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>
                                <Clock className="w-3 h-3" />
                                {alert.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                        <button
                            onClick={() => dismissAlert(alert.id)}
                            className="p-1 rounded-lg flex-shrink-0 transition-colors duration-300"
                            style={{ color: 'var(--theme-text-tertiary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--theme-text-tertiary)'; }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Expand Button */}
            {activeAlerts.length > 3 && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full py-2 text-center text-sm text-blue-400 hover:bg-white/5"
                >
                    {expanded ? 'عرض أقل' : `عرض الكل (${activeAlerts.length})`}
                </button>
            )}
        </div>
    );
};

export default SmartAlertsPanel;
