/**
 * Multi-Tenant Customization Service
 * Branding and customization per tenant
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface TenantBranding {
    tenantId: string;
    
    // Logo & Colors
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    
    // Typography
    fontFamily?: string;
    headingFont?: string;
    
    // UI Elements
    buttonStyle?: 'rounded' | 'square' | 'pill';
    cardStyle?: 'glass' | 'solid' | 'bordered';
    theme?: 'light' | 'dark' | 'auto';
    
    // Custom Features
    enabledFeatures?: string[];
    disabledFeatures?: string[];
    
    // Custom Settings
    customSettings?: Record<string, any>;
    
    // Metadata
    updatedAt?: Date;
    updatedBy?: string;
}

export interface TenantSettings {
    tenantId: string;
    
    // General
    language?: 'ar' | 'en';
    timezone?: string;
    dateFormat?: string;
    timeFormat?: '12h' | '24h';
    
    // Notifications
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
    
    // Business
    businessName?: string;
    businessType?: string;
    taxId?: string;
    vatNumber?: string;
    
    // Custom Fields
    customFields?: Record<string, any>;
    
    // Metadata
    updatedAt?: Date;
    updatedBy?: string;
}

// ============================================================
// BRANDING MANAGEMENT
// ============================================================

/**
 * Get tenant branding
 */
export const getTenantBranding = async (tenantId: string): Promise<TenantBranding | null> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings`, 'branding');
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const data = snap.data();
            return {
                tenantId,
                ...data,
                updatedAt: data.updatedAt?.toDate()
            } as TenantBranding;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting tenant branding:', error);
        return null;
    }
};

/**
 * Save tenant branding
 */
export const saveTenantBranding = async (
    tenantId: string,
    branding: Partial<TenantBranding>,
    updatedBy: string
): Promise<void> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings`, 'branding');
        await setDoc(docRef, {
            tenantId,
            ...branding,
            updatedAt: serverTimestamp(),
            updatedBy
        }, { merge: true });
    } catch (error) {
        console.error('Error saving tenant branding:', error);
        throw error;
    }
};

// ============================================================
// SETTINGS MANAGEMENT
// ============================================================

/**
 * Get tenant settings
 */
export const getTenantSettings = async (tenantId: string): Promise<TenantSettings | null> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings`, 'general');
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const data = snap.data();
            return {
                tenantId,
                ...data,
                updatedAt: data.updatedAt?.toDate()
            } as TenantSettings;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting tenant settings:', error);
        return null;
    }
};

/**
 * Save tenant settings
 */
export const saveTenantSettings = async (
    tenantId: string,
    settings: Partial<TenantSettings>,
    updatedBy: string
): Promise<void> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings`, 'general');
        await setDoc(docRef, {
            tenantId,
            ...settings,
            updatedAt: serverTimestamp(),
            updatedBy
        }, { merge: true });
    } catch (error) {
        console.error('Error saving tenant settings:', error);
        throw error;
    }
};

// ============================================================
// FEATURE TOGGLE
// ============================================================

/**
 * Check if feature is enabled for tenant
 */
export const isFeatureEnabledForTenant = async (
    tenantId: string,
    featureName: string
): Promise<boolean> => {
    try {
        const branding = await getTenantBranding(tenantId);
        if (!branding) return true; // Default: enabled
        
        // Check disabled features
        if (branding.disabledFeatures?.includes(featureName)) {
            return false;
        }
        
        // Check enabled features (if specified, only these are enabled)
        if (branding.enabledFeatures && branding.enabledFeatures.length > 0) {
            return branding.enabledFeatures.includes(featureName);
        }
        
        // Default: enabled
        return true;
    } catch (error) {
        console.error('Error checking feature:', error);
        return true; // Fail open
    }
};
