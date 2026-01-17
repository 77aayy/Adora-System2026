/**
 * System Configs Service
 * Manages dynamic API keys and service configurations
 * Allows Owner to manage keys from dashboard instead of .env files
 */

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { validateRoleAccess } from './tenantSecurityService';

// ============================================================
// TYPES
// ============================================================

export interface SystemConfigs {
    // Firebase Configuration
    firebase: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    };
    // Push Notifications (FCM)
    vapidKey: string;
    // Image Upload
    imgbbApiKey: string;
    // Metadata
    lastUpdated: Date;
    updatedBy: string;
}

export interface KeyValidationResult {
    isValid: boolean;
    message: string;
}

// ============================================================
// CACHE
// ============================================================

let cachedConfigs: SystemConfigs | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================================
// FUNCTIONS
// ============================================================

/**
 * Get system configs from Firestore with caching
 * 🔐 RBAC: Only Owner can access API keys (sensitive data)
 */
export const getSystemConfigs = async (): Promise<SystemConfigs | null> => {
    try {
        // ✅ RBAC: Check role before accessing sensitive API keys
        validateRoleAccess('owner');

        // Return cached data if still valid
        if (cachedConfigs && Date.now() - cacheTimestamp < CACHE_TTL) {
            return cachedConfigs;
        }

        if (!db) {
            console.warn('⚠️ Database not initialized, using fallback configs');
            return null;
        }

        const configRef = doc(db, 'system_configs', 'api_keys');
        const configDoc = await getDoc(configRef);

        if (configDoc.exists()) {
            const data = configDoc.data();
            cachedConfigs = {
                firebase: data.firebase || {},
                vapidKey: data.vapidKey || '',
                imgbbApiKey: data.imgbbApiKey || '',
                lastUpdated: data.lastUpdated?.toDate() || new Date(),
                updatedBy: data.updatedBy || ''
            };
            cacheTimestamp = Date.now();
            return cachedConfigs;
        }

        return null;
    } catch (error) {
        console.error('Error fetching system configs:', error);
        throw error; // ✅ Re-throw to show error to caller (don't silently fail)
    }
};

/**
 * Save system configs to Firestore
 * 🔐 RBAC: Only Owner can save API keys (sensitive data)
 */
export const saveSystemConfigs = async (
    configs: Partial<SystemConfigs>,
    userId: string
): Promise<{ success: boolean; message: string }> => {
    try {
        // ✅ RBAC: Check role before saving sensitive API keys
        validateRoleAccess('owner');

        if (!db) {
            return { success: false, message: 'قاعدة البيانات غير متصلة' };
        }

        const configRef = doc(db, 'system_configs', 'api_keys');
        
        // Get existing configs
        const existingDoc = await getDoc(configRef);
        const existingData = existingDoc.exists() ? existingDoc.data() : {};

        // Merge with existing data
        await setDoc(configRef, {
            ...existingData,
            ...configs,
            lastUpdated: Timestamp.now(),
            updatedBy: userId
        }, { merge: true });

        // Clear cache to force refresh
        cachedConfigs = null;
        cacheTimestamp = 0;

        return { success: true, message: 'تم حفظ الإعدادات بنجاح' };
    } catch (error) {
        console.error('Error saving system configs:', error);
        return { success: false, message: 'حدث خطأ أثناء حفظ الإعدادات' };
    }
};

/**
 * Get VAPID Key - checks Firestore first, then .env fallback
 */
export const getVapidKey = async (): Promise<string> => {
    const configs = await getSystemConfigs();
    if (configs?.vapidKey) {
        return configs.vapidKey;
    }
    // Fallback to environment variable
    return import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
};

/**
 * Get ImgBB API Key - checks Firestore first, then .env fallback
 */
export const getImgbbApiKey = async (): Promise<string> => {
    const configs = await getSystemConfigs();
    if (configs?.imgbbApiKey) {
        return configs.imgbbApiKey;
    }
    // Fallback to environment variable
    return import.meta.env.VITE_IMGBB_API_KEY || '';
};

/**
 * Validate VAPID Key
 */
export const validateVapidKey = async (key: string): Promise<KeyValidationResult> => {
    try {
        // VAPID key should be a valid base64 string of specific length
        if (!key || key.length < 80) {
            return { isValid: false, message: 'مفتاح VAPID غير صالح - يجب أن يكون أطول' };
        }

        // Basic base64 validation
        const base64Regex = /^[A-Za-z0-9+/=_-]+$/;
        if (!base64Regex.test(key)) {
            return { isValid: false, message: 'مفتاح VAPID يحتوي على أحرف غير صالحة' };
        }

        return { isValid: true, message: 'مفتاح VAPID صالح ✓' };
    } catch (error) {
        return { isValid: false, message: 'فشل في التحقق من المفتاح' };
    }
};

/**
 * Validate ImgBB API Key by making a test request
 */
export const validateImgbbKey = async (key: string): Promise<KeyValidationResult> => {
    try {
        if (!key || key.length < 10) {
            return { isValid: false, message: 'مفتاح ImgBB غير صالح' };
        }

        // Test with a small base64 image (1x1 transparent pixel)
        const testImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        
        const formData = new FormData();
        formData.append('key', key);
        formData.append('image', testImage);

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.success) {
            return { isValid: true, message: 'مفتاح ImgBB صالح ✓' };
        } else {
            return { isValid: false, message: data.error?.message || 'مفتاح ImgBB غير صالح' };
        }
    } catch (error) {
        return { isValid: false, message: 'فشل في اختبار المفتاح - تحقق من الاتصال' };
    }
};

/**
 * Clear cached configs (useful after updates)
 */
export const clearConfigsCache = (): void => {
    cachedConfigs = null;
    cacheTimestamp = 0;
};
