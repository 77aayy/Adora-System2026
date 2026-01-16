/**
 * Department Utilities
 * Centralized department name mapping and helpers
 * Adora Hotel Management System
 */

import { TFunction } from 'i18next';

/**
 * Get localized department name
 * @param dept Department key
 * @param t Translation function
 * @returns Localized department name
 */
export const getDeptName = (dept: string, t: TFunction): string => {
    const deptMap: Record<string, string> = {
        'reception': t('departments.reception'),
        'housekeeping': t('departments.housekeeping'),
        'maintenance': t('departments.maintenance'),
        'bellman': t('departments.bellman'),
        'coffee_shop': t('departments.coffeeshop'),
        'coffeeshop': t('departments.coffeeshop'),
        'procurement': t('departments.procurement')
    };
    return deptMap[dept] || dept;
};

/**
 * Get all department names as a map
 * @param t Translation function
 * @returns Map of department keys to localized names
 */
export const getDepartmentMap = (t: TFunction): Record<string, string> => {
    return {
        'reception': t('departments.reception'),
        'housekeeping': t('departments.housekeeping'),
        'maintenance': t('departments.maintenance'),
        'bellman': t('departments.bellman'),
        'coffee_shop': t('departments.coffeeshop'),
        'coffeeshop': t('departments.coffeeshop'),
        'procurement': t('departments.procurement')
    };
};
