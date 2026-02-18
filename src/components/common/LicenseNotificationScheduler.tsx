/**
 * License Notification Scheduler Component
 * Invisible component that checks license expiry and creates notifications
 * Adora Hotel Management System V3
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { checkAllManagersLicenseExpiry } from '../../services/licenseNotificationService';
import { logger } from '../../services/loggerService';

export const LicenseNotificationScheduler: React.FC = () => {
    const { user } = useAuth();
    const lastCheckDateRef = useRef<string>('');
    const isRunningRef = useRef(false);

    useEffect(() => {
        // Only run for owner
        if (user?.role !== 'owner') return;

        const checkLicenseExpiry = async () => {
            // Prevent concurrent runs
            if (isRunningRef.current) {
                logger.debug('License check already running, skipping...', undefined, 'LicenseNotificationScheduler');
                return;
            }

            const today = new Date().toDateString();
            
            // Check if already checked today (can check multiple times per day, but limit frequency)
            const lastCheck = lastCheckDateRef.current;
            if (lastCheck === today) {
                // Allow checks every 6 hours
                const lastCheckTime = localStorage.getItem('lastLicenseCheckTime');
                if (lastCheckTime) {
                    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
                    if (parseInt(lastCheckTime) > sixHoursAgo) {
                        return;
                    }
                }
            }

            try {
                isRunningRef.current = true;
                logger.debug('Checking license expiry for all managers...', undefined, 'LicenseNotificationScheduler');

                const notifications = await checkAllManagersLicenseExpiry();

                lastCheckDateRef.current = today;
                localStorage.setItem('lastLicenseCheckTime', Date.now().toString());

                if (notifications.length > 0) {
                    logger.info(
                        `License expiry check completed: ${notifications.length} notifications created`,
                        { count: notifications.length },
                        'LicenseNotificationScheduler'
                    );
                }
            } catch (error) {
                logger.error('Failed to check license expiry', error, 'LicenseNotificationScheduler');
            } finally {
                isRunningRef.current = false;
            }
        };

        // Run immediately on mount (if owner)
        checkLicenseExpiry();

        // Run every 6 hours
        const interval = setInterval(checkLicenseExpiry, 6 * 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user?.role]);

    return null; // Invisible component
};
