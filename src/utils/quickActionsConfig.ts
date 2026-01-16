/**
 * Quick Actions Configuration
 * Centralized quick action definitions
 * Adora Hotel Management System
 */

import React from 'react';
import { TFunction } from 'i18next';
import { 
    Sparkles, Wrench, Bell, Coffee, Eye, AlertTriangle 
} from 'lucide-react';

export interface QuickAction {
    type: 'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'inspection' | 'other';
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    bgColor: string;
}

/**
 * Get quick actions configuration
 * Returns icon components (not JSX) to be rendered in components
 */
export const getQuickActions = (t: TFunction): QuickAction[] => [
    { 
        type: 'cleaning', 
        icon: Sparkles, 
        label: t('reception.quickActionLabels.cleaning'), 
        color: 'adora-service-housekeeping', 
        bgColor: 'adora-service-bg-housekeeping' 
    },
    { 
        type: 'maintenance', 
        icon: Wrench, 
        label: t('reception.quickActionLabels.maintenance'), 
        color: 'adora-service-maintenance', 
        bgColor: 'adora-service-bg-maintenance' 
    },
    { 
        type: 'bellman', 
        icon: Bell, 
        label: t('reception.quickActionLabels.bellman'), 
        color: 'adora-service-bellman', 
        bgColor: 'adora-service-bg-bellman' 
    },
    { 
        type: 'coffee', 
        icon: Coffee, 
        label: t('reception.quickActionLabels.coffee'), 
        color: 'adora-service-coffee', 
        bgColor: 'adora-service-bg-coffee' 
    },
    { 
        type: 'inspection', 
        icon: Eye, 
        label: t('reception.quickActionLabels.inspection'), 
        color: 'adora-service-inspection', 
        bgColor: 'adora-service-bg-inspection' 
    },
    { 
        type: 'other', 
        icon: AlertTriangle, 
        label: t('reception.quickActionLabels.other'), 
        color: 'adora-service-emergency', 
        bgColor: 'adora-service-bg-emergency' 
    },
];

/**
 * Helper to render icon from QuickAction
 * Note: This function returns JSX, so it should be used in .tsx files only
 */
export const renderQuickActionIcon = (action: QuickAction, className: string = 'w-6 h-6'): React.ReactElement => {
    const IconComponent = action.icon;
    return React.createElement(IconComponent, { className });
};
