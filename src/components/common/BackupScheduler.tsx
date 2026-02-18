/**
 * Backup Scheduler Component
 * Invisible component that runs daily backups automatically
 * Adora Hotel Management System V3
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { createDailyBackupsForAllTenants } from '../../services/backupService';
import { logger } from '../../services/loggerService';

export const BackupScheduler: React.FC = () => {
    const { user } = useAuth();
    const lastBackupDateRef = useRef<string>('');
    const isRunningRef = useRef(false);

    useEffect(() => {
        // Only run for owner
        if (user?.role !== 'owner') return;

        const runDailyBackups = async () => {
            // Prevent concurrent runs
            if (isRunningRef.current) {
                logger.debug('Backup already running, skipping...', undefined, 'BackupScheduler');
                return;
            }

            const today = new Date().toDateString();
            
            // Check if backup already ran today
            if (lastBackupDateRef.current === today) {
                logger.debug('Backup already ran today', undefined, 'BackupScheduler');
                return;
            }

            try {
                isRunningRef.current = true;
                logger.debug('Starting daily backups for all tenants...', undefined, 'BackupScheduler');

                const result = await createDailyBackupsForAllTenants();

                lastBackupDateRef.current = today;

                logger.debug(
                    `Daily backups completed: ${result.success} succeeded, ${result.failed} failed`,
                    result,
                    'BackupScheduler'
                );
            } catch (error) {
                logger.error('Failed to run daily backups', error, 'BackupScheduler');
            } finally {
                isRunningRef.current = false;
            }
        };

        // Run immediately on mount (if owner)
        runDailyBackups();

        // Run every hour (check if backup needed)
        const interval = setInterval(runDailyBackups, 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user?.role]);

    return null; // Invisible component
};
