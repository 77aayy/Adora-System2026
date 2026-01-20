/**
 * License Notification Widget
 * Displays license expiry notifications for owner and managers
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Bell, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getLicenseNotificationsForOwner, getLicenseNotificationsForManager, type LicenseNotification } from '../../services/licenseNotificationService';
import { logger } from '../../services/loggerService';
import { useTranslation } from 'react-i18next';

interface LicenseNotificationWidgetProps {
    forOwner?: boolean; // If true, shows all managers' notifications. If false, shows only current manager's
    className?: string;
    maxNotifications?: number;
}

export const LicenseNotificationWidget: React.FC<LicenseNotificationWidgetProps> = ({
    forOwner = false,
    className = '',
    maxNotifications = 5,
}) => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [notifications, setNotifications] = useState<LicenseNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const loadNotifications = async () => {
            try {
                setLoading(true);
                let result: LicenseNotification[] = [];

                if (forOwner && user.role === 'owner') {
                    // ✅ For owner, load from licenseNotifications collection (created by scheduler)
                    // Don't call checkAllManagersLicenseExpiry() - it's too slow and runs in scheduler
                    try {
                        const { collection, query, getDocs, orderBy, limit } = await import('firebase/firestore');
                        const { db } = await import('../../services/firebase');
                        
                        if (!db) {
                            logger.warn('Firestore db not available in loadNotifications', null, 'LicenseNotificationWidget');
                            result = [];
                        } else {
                            const notificationsRef = collection(db, 'licenseNotifications');
                            
                            // ✅ Try to get notifications with orderBy, fallback if index missing
                            let snapshot;
                            try {
                                snapshot = await Promise.race([
                                    getDocs(
                                        query(
                                            notificationsRef,
                                            orderBy('notifiedAt', 'desc'),
                                            limit(maxNotifications * 2)
                                        )
                                    ),
                                    new Promise((_, reject) => 
                                        setTimeout(() => reject(new Error('Timeout')), 3000)
                                    ) as Promise<any>
                                ]);
                            } catch (indexError: any) {
                                // ✅ Handle Firestore internal errors gracefully
                                if (indexError?.message?.includes('INTERNAL ASSERTION FAILED')) {
                                    logger.warn('Firestore internal error in loadNotifications (likely cache issue)', indexError, 'LicenseNotificationWidget');
                                    result = [];
                                    return;
                                }
                                
                                // ✅ Fallback: Get without orderBy if index doesn't exist or timeout
                                if (indexError.code === 'failed-precondition' || indexError.message === 'Timeout') {
                                    logger.warn('Using fallback query (no orderBy)', indexError, 'LicenseNotificationWidget');
                                    snapshot = await getDocs(
                                        query(notificationsRef, limit(maxNotifications * 2))
                                    );
                                } else {
                                    throw indexError;
                                }
                            }
                            
                            result = snapshot.docs
                                .map((doc) => {
                                    const data = doc.data();
                                    if (!data.managerId || !data.tenantId) return null;
                                    
                                    // Generate message if missing
                                    let message = data.message || '';
                                    if (!message && data.daysUntilExpiry !== undefined) {
                                        const days = data.daysUntilExpiry;
                                        // ✅ Use translation keys instead of hardcoded Arabic
                                        if (days <= 0) message = `⚠️ ${t('licenseNotification.expired')}`;
                                        else if (days === 1) message = `🔴 ${t('licenseNotification.expiresTomorrow')}`;
                                        else if (days === 7) message = `⚠️ ${t('licenseNotification.expiresIn7Days')}`;
                                        else if (days === 30) message = `ℹ️ ${t('licenseNotification.expiresIn30Days')}`;
                                    }
                                    
                                    return {
                                        tenantId: data.tenantId,
                                        managerId: data.managerId,
                                        managerName: data.managerName || t('common.unknown'),
                                        daysUntilExpiry: data.daysUntilExpiry ?? 0,
                                        notificationType: data.notificationType || '30days',
                                        message: message || t('licenseNotification.expiryNotification'),
                                        notifiedAt: data.notifiedAt?.toDate() || new Date(),
                                        notified: data.notified !== false,
                                    } as LicenseNotification;
                                })
                                .filter((n): n is LicenseNotification => n !== null)
                                // Sort by notifiedAt if we couldn't use orderBy
                                .sort((a, b) => b.notifiedAt.getTime() - a.notifiedAt.getTime())
                                .slice(0, maxNotifications);
                        }
                    } catch (err: any) {
                        // ✅ Handle Firestore internal errors gracefully
                        if (err?.message?.includes('INTERNAL ASSERTION FAILED') || err?.message?.includes('Unexpected state')) {
                            logger.warn('Firestore internal error in loadNotifications (likely cache issue)', err, 'LicenseNotificationWidget');
                        } else {
                            // ✅ Handle permission errors gracefully (expected for non-owners)
                            const isPermissionError = err?.code === 'permission-denied' || 
                                                      err?.message?.includes('permission') ||
                                                      err?.message?.includes('Missing or insufficient');
                            
                            if (isPermissionError) {
                                logger.warn('Permission denied for license notifications (expected for non-owners)', undefined, 'LicenseNotificationWidget');
                            } else {
                                logger.error('Failed to load notifications from Firestore', err, 'LicenseNotificationWidget');
                            }
                        }
                        result = [];
                    }
                } else if (user.tenantId && user.id) {
                    // Load current manager's notifications
                    result = await getLicenseNotificationsForManager(user.tenantId, user.id);
                }

                setNotifications(result.slice(0, maxNotifications));
            } catch (error) {
                logger.error('Failed to load license notifications', error, 'LicenseNotificationWidget');
                // Don't block UI - just show empty
                setNotifications([]);
            } finally {
                setLoading(false);
            }
        };

        loadNotifications();
        
        // Refresh every 5 minutes
        const interval = setInterval(loadNotifications, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, forOwner, maxNotifications]);

    const handleDismiss = (notificationId: string) => {
        setDismissed((prev) => new Set(prev).add(notificationId));
    };

    if (loading) {
        return (
            <div className={`p-4 rounded-xl glass ${className}`}>
                <div className="flex items-center gap-2 text-white/60">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span className="text-sm">{t('common.loading')}</span>
                </div>
            </div>
        );
    }

    const visibleNotifications = notifications.filter((n) => !dismissed.has(`${n.managerId}-${n.daysUntilExpiry}-${n.notificationType}`));

    if (visibleNotifications.length === 0) {
        return null; // Don't render widget if no notifications
    }

    const getNotificationIcon = (type: LicenseNotification['notificationType']) => {
        switch (type) {
            case 'expired':
                return <AlertTriangle className="w-5 h-5 text-red-400" />;
            case 'day':
                return <AlertTriangle className="w-5 h-5 text-red-400" />;
            case '7days':
                return <AlertTriangle className="w-5 h-5 text-orange-400" />;
            case '30days':
                return <Bell className="w-5 h-5 text-yellow-400" />;
            default:
                return <Bell className="w-5 h-5 text-blue-400" />;
        }
    };

    const getNotificationColor = (type: LicenseNotification['notificationType']) => {
        switch (type) {
            case 'expired':
                return 'bg-red-500/10 border-red-500/30 text-red-300';
            case 'day':
                return 'bg-red-500/10 border-red-500/30 text-red-300';
            case '7days':
                return 'bg-orange-500/10 border-orange-500/30 text-orange-300';
            case '30days':
                return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300';
            default:
                return 'bg-blue-500/10 border-blue-500/30 text-blue-300';
        }
    };

    return (
        <div className={`p-4 rounded-xl glass border border-white/10 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary-400" />
                    <h3 className="text-sm font-bold text-white">
                        {forOwner ? t('licenseNotification.licenseNotifications') : t('licenseNotification.licenseNotification')}
                    </h3>
                </div>
                {visibleNotifications.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary-500/20 text-primary-400 border border-primary-500/30">
                        {visibleNotifications.length}
                    </span>
                )}
            </div>

            <div className="space-y-2">
                {visibleNotifications.map((notification, index) => {
                    const notificationId = `${notification.managerId}-${notification.daysUntilExpiry}-${notification.notificationType}`;
                    return (
                        <div
                            key={notificationId}
                            className={`p-3 rounded-lg border ${getNotificationColor(
                                notification.notificationType
                            )} relative`}
                        >
                            <div className="flex items-start gap-3">
                                {getNotificationIcon(notification.notificationType)}
                                <div className="flex-1 min-w-0">
                                    {forOwner && (
                                        <p className="text-xs font-bold text-white/80 mb-1">
                                            {notification.managerName}
                                        </p>
                                    )}
                                    <p className="text-xs leading-relaxed">{notification.message}</p>
                                    {notification.daysUntilExpiry !== null && (
                                        <p className="text-xs text-white/50 mt-1">
                                            {t('licenseNotification.remaining')}: {notification.daysUntilExpiry} {notification.daysUntilExpiry === 1 ? t('common.day') : t('common.days')}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDismiss(notificationId)}
                                    className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                                    title={t('common.hide') || 'إخفاء'}
                                >
                                    <X className="w-3 h-3 text-white/60" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {visibleNotifications.length >= maxNotifications && (
                <p className="text-xs text-white/50 text-center mt-3">
                    {t('licenseNotification.moreNotifications', { count: notifications.length - maxNotifications })}
                </p>
            )}
        </div>
    );
};
