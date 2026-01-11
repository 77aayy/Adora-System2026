/**
 * Points Settings Service
 * Configurable point values from admin
 * Adora Hotel Management System V2
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// ============================================================
// TYPES
// ============================================================

export interface PointsConfig {
    // Reception
    reception_createRequest: number;
    reception_confirmRequest: number;
    reception_completeRequest: number;

    // Housekeeping
    housekeeping_startCleaning: number;
    housekeeping_completeCleaning: number;
    housekeeping_completeInspection: number;
    housekeeping_postMaintenanceInspection: number;

    // Maintenance
    maintenance_completeRepair: number;
    maintenance_urgentRepair: number;

    // Bellman
    bellman_checkIn: number;
    bellman_checkOut: number;
    bellman_completeRequest: number;

    // Procurement
    procurement_purchase: number;
    procurement_receive: number;
}

// ============================================================
// DEFAULTS
// ============================================================

export const DEFAULT_POINTS: PointsConfig = {
    // Reception
    reception_createRequest: 1,
    reception_confirmRequest: 1,
    reception_completeRequest: 2,

    // Housekeeping
    housekeeping_startCleaning: 1,
    housekeeping_completeCleaning: 3,
    housekeeping_completeInspection: 2,
    housekeeping_postMaintenanceInspection: 2,

    // Maintenance
    maintenance_completeRepair: 4,
    maintenance_urgentRepair: 6,

    // Bellman
    bellman_checkIn: 2,
    bellman_checkOut: 2,
    bellman_completeRequest: 3,

    // Procurement
    procurement_purchase: 2,
    procurement_receive: 3,
};

// ============================================================
// CACHE
// ============================================================

let cachedConfig: PointsConfig | null = null;

// ============================================================
// FUNCTIONS
// ============================================================

/**
 * Get points configuration
 */
export const getPointsConfig = async (): Promise<PointsConfig> => {
    if (cachedConfig) return cachedConfig;

    try {
        const configRef = doc(db, 'settings', 'points');
        const configDoc = await getDoc(configRef);

        if (configDoc.exists()) {
            cachedConfig = { ...DEFAULT_POINTS, ...configDoc.data() } as PointsConfig;
        } else {
            cachedConfig = DEFAULT_POINTS;
        }

        return cachedConfig;
    } catch (error) {
        console.error('Failed to load points config:', error);
        return DEFAULT_POINTS;
    }
};

/**
 * Update points configuration
 */
export const updatePointsConfig = async (config: Partial<PointsConfig>): Promise<void> => {
    const configRef = doc(db, 'settings', 'points');
    await setDoc(configRef, config, { merge: true });
    cachedConfig = null; // Clear cache
};

/**
 * Get points for a specific action
 */
export const getPointsFor = async (action: keyof PointsConfig): Promise<number> => {
    const config = await getPointsConfig();
    return config[action] || 0;
};

/**
 * Clear cached config (for testing or admin updates)
 */
export const clearPointsCache = (): void => {
    cachedConfig = null;
};

// ============================================================
// ACTION LABELS
// ============================================================

export const getActionLabel = (action: keyof PointsConfig): string => {
    const labels: Record<keyof PointsConfig, string> = {
        reception_createRequest: 'إنشاء طلب (استقبال)',
        reception_confirmRequest: 'تأكيد طلب (استقبال)',
        reception_completeRequest: 'إتمام طلب (استقبال)',
        housekeeping_startCleaning: 'بدء التنظيف',
        housekeeping_completeCleaning: 'إتمام التنظيف',
        housekeeping_completeInspection: 'إتمام الفحص',
        housekeeping_postMaintenanceInspection: 'فحص ما بعد الصيانة',
        maintenance_completeRepair: 'إتمام الصيانة',
        maintenance_urgentRepair: 'صيانة عاجلة',
        bellman_checkIn: 'تسجيل دخول',
        bellman_checkOut: 'تسجيل خروج',
        bellman_completeRequest: 'إتمام طلب بيلمان',
        procurement_purchase: 'شراء',
        procurement_receive: 'استلام',
    };
    return labels[action];
};
