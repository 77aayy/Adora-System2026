/**
 * Status Configuration
 * Centralized status definitions for all dashboards
 * Adora Hotel Management System
 */

import { TFunction } from 'i18next';
import { AlertCircle, Check, Clock, CheckCircle2, Wrench, Eye, Calendar } from 'lucide-react';

export interface StatusConfigItem {
    label: string;
    color: string;
    bg: string;
    icon: React.ComponentType<any>;
}

export type StatusConfig = Record<string, StatusConfigItem>;

/**
 * Get status configuration for Reception Dashboard
 */
export const getReceptionStatusConfig = (t: TFunction): StatusConfig => ({
    PENDING: { 
        label: t('reception.statusLabels.pending'), 
        color: 'adora-status-pending', 
        bg: 'adora-status-bg-pending', 
        icon: AlertCircle 
    },
    PENDING_RECEPTION: { 
        label: t('reception.statusLabels.pendingReception'), 
        color: 'adora-status-warning', 
        bg: 'adora-status-bg-warning', 
        icon: AlertCircle 
    },
    CONFIRMED: { 
        label: t('reception.statusLabels.confirmed'), 
        color: 'adora-status-confirmed', 
        bg: 'adora-status-bg-confirmed', 
        icon: Check 
    },
    IN_PROGRESS: { 
        label: t('reception.statusLabels.inProgress'), 
        color: 'adora-status-progress', 
        bg: 'adora-status-bg-progress', 
        icon: Clock 
    },
    COMPLETED: { 
        label: t('reception.statusLabels.completed'), 
        color: 'adora-status-success', 
        bg: 'adora-status-bg-success', 
        icon: CheckCircle2 
    },
    WAITING_PARTS: { 
        label: t('reception.statusLabels.waitingParts'), 
        color: 'adora-status-danger', 
        bg: 'adora-status-bg-danger', 
        icon: Wrench 
    },
    NEEDS_INSPECTION: { 
        label: t('reception.statusLabels.needsInspection'), 
        color: 'adora-status-progress', 
        bg: 'adora-status-bg-progress', 
        icon: Eye 
    },
    SCHEDULED: { 
        label: t('reception.statusLabels.scheduled'), 
        color: 'adora-status-confirmed', 
        bg: 'adora-status-bg-confirmed', 
        icon: Calendar 
    }
});
