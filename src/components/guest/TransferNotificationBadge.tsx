/**
 * Transfer Notification Badge
 * Shows room transfer notifications for department dashboards
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, X, Eye, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import {
    subscribeToDepartmentTransferNotifications,
    markTransferNotificationAsRead,
    TransferNotification
} from '../../services/roomTransferService';

interface TransferNotificationBadgeProps {
    department: string;
    className?: string;
}

export const TransferNotificationBadge: React.FC<TransferNotificationBadgeProps> = ({
    department,
    className = ''
}) => {
    const { user, branchId } = useAuth();
    const { haptic } = useUX();
    const [notifications, setNotifications] = useState<TransferNotification[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);

    const tenantId = user?.tenantId || '';

    useEffect(() => {
        if (!tenantId || !branchId || !department) return;

        const unsubscribe = subscribeToDepartmentTransferNotifications(
            tenantId,
            branchId,
            department,
            (newNotifications) => {
                setNotifications(newNotifications);
                
                // Haptic feedback for new notifications
                if (newNotifications.length > notifications.length) {
                    haptic('warning');
                }
            }
        );

        return () => unsubscribe();
    }, [tenantId, branchId, department]);

    const handleMarkAsRead = async (notificationId: string) => {
        try {
            await markTransferNotificationAsRead(notificationId);
            haptic('light');
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        for (const notification of notifications) {
            if (notification.id) {
                await markTransferNotificationAsRead(notification.id);
            }
        }
        haptic('success');
        setShowDropdown(false);
    };

    if (notifications.length === 0) return null;

    return (
        <div className={`relative ${className}`}>
            {/* Badge Button */}
            <button
                onClick={() => {
                    setShowDropdown(!showDropdown);
                    haptic('light');
                }}
                className="relative p-2 rounded-xl transition-all hover:bg-white/10"
                style={{ background: 'var(--theme-bg-tertiary)' }}
            >
                <ArrowLeftRight className="w-5 h-5 text-orange-400" />
                {/* Count Badge */}
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {notifications.length}
                </span>
            </button>

            {/* Dropdown */}
            {showDropdown && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
                    />

                    {/* Notification List */}
                    <div
                        className="absolute top-full left-0 mt-2 w-80 rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2"
                        style={{
                            background: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border-primary)',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
                        }}
                    >
                        {/* Header */}
                        <div className="p-3 border-b flex items-center justify-between"
                            style={{ borderColor: 'var(--theme-border-primary)' }}
                        >
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-orange-400" />
                                <span className="font-bold text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                                    تنبيهات نقل الغرف
                                </span>
                            </div>
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-teal-400 hover:underline"
                            >
                                تحديد الكل كمقروء
                            </button>
                        </div>

                        {/* Notifications */}
                        <div className="max-h-72 overflow-y-auto">
                            {notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className="p-3 border-b hover:bg-white/5 transition-colors"
                                    style={{ borderColor: 'var(--theme-border-primary)' }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                            <ArrowLeftRight className="w-5 h-5 text-orange-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {notification.message}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                                                    {notification.fromRoom}
                                                </span>
                                                <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>→</span>
                                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                                                    {notification.toRoom}
                                                </span>
                                            </div>
                                            {notification.createdAt && (
                                                <p className="text-[10px] mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                    {typeof notification.createdAt.toDate === 'function'
                                                        ? notification.createdAt.toDate().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                                                        : new Date(notification.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                                                    }
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => notification.id && handleMarkAsRead(notification.id)}
                                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                            style={{ color: 'var(--theme-text-tertiary)' }}
                                            title="تحديد كمقروء"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-2 text-center" style={{ background: 'var(--theme-bg-tertiary)' }}>
                            <p className="text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                انقر على <Eye className="w-3 h-3 inline" /> لتحديد كمقروء
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TransferNotificationBadge;
