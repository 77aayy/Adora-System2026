/**
 * Service Names Configuration
 * Centralized service name mappings
 * Adora Hotel Management System
 */

import { TFunction } from 'i18next';

/**
 * Get service names mapping
 */
export const getServiceNames = (t: TFunction): Record<string, string> => ({
    cleaning: t('reception.serviceNames.cleaning'),
    maintenance: t('reception.serviceNames.maintenance'),
    bellman: t('reception.serviceNames.bellman'),
    coffee: t('reception.serviceNames.coffee'),
    laundry: t('reception.serviceNames.laundry'),
    minibar: t('reception.serviceNames.minibar'),
    inspection: t('reception.serviceNames.inspection'),
    extension: t('reception.serviceNames.extension'),
    other: t('reception.serviceNames.other')
});
