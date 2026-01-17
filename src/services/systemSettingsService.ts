/**
 * System Settings Service
 * Centralized system-wide settings management for SaaS owner
 * Allows owner to control global settings that affect all tenants
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface SystemSettings {
    // General Settings
    maintenanceMode: boolean;
    maintenanceMessage?: string;
    systemVersion: string;
    lastUpdateDate?: Date;
    defaultSubscriptionPrice?: number; // ✅ Default subscription price (applies to new subscriptions only)
    defaultTaxRate?: number; // ✅ Default VAT percentage (e.g. 15)
    // ✅ Company Information for Receipt Vouchers, Invoices, and Expense Vouchers
    companyName?: string; // اسم الشركة
    companyTaxNumber?: string; // الرقم الضريبي
    companyAddress?: string; // عنوان الشركة
    commercialRegistrationNumber?: string; // رقم السجل التجاري
    contactPhone?: string; // أرقام التواصل (هاتف)
    contactEmail?: string; // البريد الإلكتروني
    contactWebsite?: string; // الموقع الإلكتروني (اختياري)
    
    // Feature Flags (Control which features are available to tenants)
    features: {
        // Core Features
        qrCodeGuestPortal: boolean;
        pointsSystem: boolean;
        gamification: boolean;
        shiftNotes: boolean;
        scheduledTasks: boolean;
        
        // Advanced Features
        aiAssistant: boolean;
        calendarSync: boolean;
        inventoryManagement: boolean;
        procurementSystem: boolean;
        laundryManagement: boolean;
        
        // Integrations
        whatsappIntegration: boolean;
        emailNotifications: boolean;
        smsNotifications: boolean;
        
        // Experimental Features (can be enabled per tenant or globally)
        experimentalFeatures: {
            [key: string]: boolean;
        };
    };
    
    // Rate Limits & Quotas
    rateLimits: {
        requestsPerMinute: number;
        requestsPerHour: number;
        maxDevicesPerQR: number;
        maxEmployeesPerTenant: number;
        maxBranchesPerTenant: number;
    };
    
    // Pricing Tiers
    pricingTiers: {
        basic: {
            maxBranches: number;
            maxEmployees: number;
            features: string[];
            pricePerMonth: number;
        };
        pro: {
            maxBranches: number;
            maxEmployees: number;
            features: string[];
            pricePerMonth: number;
        };
        enterprise: {
            maxBranches: number;
            maxEmployees: number;
            features: string[];
            pricePerMonth: number;
        };
    };
    
    // Update Notifications
    updates: {
        version: string;
        releaseDate: Date;
        changelog: string;
        critical: boolean; // If true, forces all tenants to see update notification
        requiredUpdate: boolean; // If true, blocks access until update is acknowledged
    }[];
    
    // ✅ UI Configuration: Visible Tabs in Owner Dashboard
    // Controls which tabs appear in horizontal navigation (to avoid duplication with sidebar)
    visibleTabs?: {
        overview?: boolean;      // الرئيسية (always visible)
        tenants?: boolean;       // المشتركين (in sidebar)
        billing?: boolean;       // الفواتير (in sidebar)
        settings?: boolean;      // الإعدادات (in sidebar)
        broadcasts?: boolean;    // الرسائل (in sidebar)
        demo?: boolean;          // روابط الديمو (not in sidebar - keep visible)
        'core-config'?: boolean; // التأسيس (in sidebar)
    };
    
    // System Messages (Broadcasts to all tenants)
    broadcastMessages: {
        id: string;
        title: string;
        message: string;
        type: 'info' | 'warning' | 'success' | 'error';
        startDate: Date;
        endDate: Date;
        targetTenants?: string[]; // If empty, broadcast to all
        // Scheduled Messages (for license expiry reminders)
        isScheduled?: boolean; // If true, this is a scheduled message
        scheduleType?: 'license_expiry'; // Type of schedule
        daysBeforeExpiry?: number; // Days before license expiry to show message
        targetRoles?: ('manager' | 'employee' | 'staff')[]; // Target specific roles (not just tenants)
    }[];
    
    // Security Settings
    security: {
        requirePinComplexity: boolean;
        minPinLength: number;
        maxLoginAttempts: number;
        sessionTimeout: number; // in minutes
        enableAuditLog: boolean;
    };
    
    // Backup & Retention
    dataRetention: {
        keepDeletedRecords: number; // days
        archiveOldData: boolean;
        archiveAfterDays: number;
    };
    
    // Metadata
    updatedAt?: Date;
    updatedBy?: string;
}

// Default Settings
const DEFAULT_SETTINGS: SystemSettings = {
    maintenanceMode: false,
    maintenanceMessage: 'نظامنا تحت الصيانة. سنعود قريباً.',
    systemVersion: '3.0.0',
    defaultSubscriptionPrice: 0, // ✅ Default subscription price (0 means not set, applies to new subscriptions only)
    defaultTaxRate: 15, // ✅ Default VAT 15%
    
    features: {
        qrCodeGuestPortal: true,
        pointsSystem: true,
        gamification: true,
        shiftNotes: true,
        scheduledTasks: true,
        aiAssistant: true,
        calendarSync: true,
        inventoryManagement: true,
        procurementSystem: true,
        laundryManagement: true,
        whatsappIntegration: true,
        emailNotifications: true,
        smsNotifications: false,
        experimentalFeatures: {}
    },
    
    rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        maxDevicesPerQR: 2,
        maxEmployeesPerTenant: 100,
        maxBranchesPerTenant: 50
    },
    
    pricingTiers: {
        basic: {
            maxBranches: 1,
            maxEmployees: 10,
            features: ['qrCodeGuestPortal', 'pointsSystem', 'inventoryManagement'],
            pricePerMonth: 500
        },
        pro: {
            maxBranches: 5,
            maxEmployees: 50,
            features: ['qrCodeGuestPortal', 'pointsSystem', 'gamification', 'inventoryManagement', 'procurementSystem', 'laundryManagement', 'scheduledTasks', 'shiftNotes'],
            pricePerMonth: 1500
        },
        enterprise: {
            maxBranches: 100,
            maxEmployees: 500,
            features: ['*'], // All features
            pricePerMonth: 5000
        }
    },
    
    updates: [],
    
    broadcastMessages: [],
    
    security: {
        requirePinComplexity: false,
        minPinLength: 4,
        maxLoginAttempts: 5,
        sessionTimeout: 480, // 8 hours
        enableAuditLog: true
    },
    
    dataRetention: {
        keepDeletedRecords: 7,
        archiveOldData: false,
        archiveAfterDays: 365
    }
};

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

const SYSTEM_SETTINGS_PATH = 'system/settings';

/**
 * Get system-wide settings (accessible by all authenticated users)
 * ✅ FIX: Checks localStorage first as fallback
 */
/**
 * Get system settings with caching
 * ⚡ PERFORMANCE: Uses memory cache + localStorage fallback
 */
export const getSystemSettings = async (forceRefresh: boolean = false): Promise<SystemSettings> => {
    // ⚡ PERFORMANCE: Use memory cache for repeated calls (60 second TTL)
    const { cachedFetch } = await import('../utils/requestCache');
    
    return cachedFetch<SystemSettings>(
        'settings:system',
        async () => {
            return _fetchSystemSettings();
        },
        { ttl: 60 * 1000, forceRefresh } // 60 second cache
    );
};

// Internal function to fetch settings
const _fetchSystemSettings = async (): Promise<SystemSettings> => {
    // ✅ FIX: Always check localStorage FIRST as backup
    const localKey = 'adora_system_settings';
    const localData = localStorage.getItem(localKey);
    const localSettings = localData ? JSON.parse(localData) : null;
    
    try {
        // ✅ Guard: Return localStorage or defaults if Firebase not initialized
        if (!db) {
            console.debug('Firebase not initialized, returning local/default settings');
            return localSettings ? { ...DEFAULT_SETTINGS, ...localSettings } : DEFAULT_SETTINGS;
        }
        const docRef = doc(db, SYSTEM_SETTINGS_PATH);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const data = snap.data();
            const firebaseSettings = {
                ...DEFAULT_SETTINGS,
                ...data,
                updates: data.updates?.map((u: any) => ({
                    ...u,
                    releaseDate: u.releaseDate?.toDate() || new Date()
                })) || [],
                broadcastMessages: data.broadcastMessages?.map((m: any) => ({
                    ...m,
                    startDate: m.startDate?.toDate() || new Date(),
                    endDate: m.endDate?.toDate() || new Date()
                })) || []
            } as SystemSettings;
            
            // ✅ Sync Firebase data to localStorage for offline access
            localStorage.setItem(localKey, JSON.stringify(firebaseSettings));
            return firebaseSettings;
        }
        
        // If no settings exist in Firebase, try to create from localStorage
        if (localSettings) {
            console.log('📦 No Firebase settings, using localStorage');
            return { ...DEFAULT_SETTINGS, ...localSettings };
        }
        
        // If no settings exist anywhere, create default
        await setSystemSettings(DEFAULT_SETTINGS);
        return DEFAULT_SETTINGS;
    } catch (error) {
        console.error('Error getting system settings:', error);
        // ✅ FIX: Return localStorage settings on Firebase error (not defaults!)
        if (localSettings) {
            console.log('📦 Firebase error, using localStorage backup (price=' + localSettings.defaultSubscriptionPrice + ')');
            return { ...DEFAULT_SETTINGS, ...localSettings };
        }
        return DEFAULT_SETTINGS;
    }
};

/**
 * Helper function to safely convert Date objects in broadcast messages
 * Converts Date objects to ISO strings for safe storage
 */
const sanitizeBroadcastDates = (updates: Partial<SystemSettings>): Partial<SystemSettings> => {
    if (!updates.broadcastMessages) return updates;
    
    return {
        ...updates,
        broadcastMessages: updates.broadcastMessages.map(msg => ({
            ...msg,
            startDate: msg.startDate instanceof Date 
                ? (isNaN(msg.startDate.getTime()) ? new Date() : msg.startDate)
                : new Date(msg.startDate || Date.now()),
            endDate: msg.endDate instanceof Date 
                ? (isNaN(msg.endDate.getTime()) ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : msg.endDate)
                : new Date(msg.endDate || Date.now() + 7 * 24 * 60 * 60 * 1000),
        }))
    };
};

/**
 * Update system settings (only accessible by owner)
 * ✅ FIX: Saves to localStorage as fallback when Firebase unavailable
 */
export const updateSystemSettings = async (
    updates: Partial<SystemSettings>,
    updatedBy: string
): Promise<void> => {
    try {
        // ✅ Sanitize broadcast message dates to prevent Invalid Date errors
        const sanitizedUpdates = sanitizeBroadcastDates(updates);
        
        // ✅ Always save to localStorage as backup
        const localKey = 'adora_system_settings';
        const existing = localStorage.getItem(localKey);
        const currentLocal = existing ? JSON.parse(existing) : {};
        const merged = { ...currentLocal, ...sanitizedUpdates, updatedAt: new Date().toISOString(), updatedBy };
        localStorage.setItem(localKey, JSON.stringify(merged));
        
        // 🔍 DEBUG: Log what we're saving
        console.log('💾 updateSystemSettings: price=' + (sanitizedUpdates as any).defaultSubscriptionPrice + 
                   ', merged_price=' + merged.defaultSubscriptionPrice);
        
        if (!db) {
            console.warn('Firebase not initialized, settings saved to localStorage only');
            return; // ✅ Don't throw - localStorage backup worked
        }
        
        const docRef = doc(db, SYSTEM_SETTINGS_PATH);
        // ✅ FIX: Use setDoc with merge:true to CREATE if not exists, UPDATE if exists
        // updateDoc fails if document doesn't exist!
        await setDoc(docRef, {
            ...sanitizedUpdates,
            updatedAt: serverTimestamp(),
            updatedBy
        }, { merge: true });
        
        console.log('✅ Settings saved to Firebase successfully');
    } catch (error) {
        console.error('Error updating system settings in Firebase:', error);
        // ✅ Don't throw - localStorage backup already saved
        console.info('Settings saved to localStorage as fallback');
    }
};

/**
 * Set system settings (only accessible by owner) - Creates if doesn't exist
 */
export const setSystemSettings = async (settings: SystemSettings): Promise<void> => {
    try {
        const docRef = doc(db, SYSTEM_SETTINGS_PATH);
        await setDoc(docRef, {
            ...settings,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error setting system settings:', error);
        throw error;
    }
};

/**
 * Toggle feature flag
 */
export const toggleFeature = async (
    featureKey: keyof SystemSettings['features'],
    enabled: boolean,
    updatedBy: string
): Promise<void> => {
    const current = await getSystemSettings();
    await updateSystemSettings({
        features: {
            ...current.features,
            [featureKey]: enabled
        }
    }, updatedBy);
    
    // ✅ FIX: Invalidate cache to force refresh
    try {
        const { invalidateCache } = await import('../utils/requestCache');
        invalidateCache('settings:system');
    } catch (err) {
        console.warn('Could not invalidate cache:', err);
    }
};

/**
 * Enable/disable maintenance mode
 */
export const setMaintenanceMode = async (
    enabled: boolean,
    message?: string,
    updatedBy?: string
): Promise<void> => {
    await updateSystemSettings({
        maintenanceMode: enabled,
        maintenanceMessage: message || 'نظامنا تحت الصيانة. سنعود قريباً.'
    }, updatedBy || 'system');
};

/**
 * Add system update notification
 */
export const addSystemUpdate = async (
    update: SystemSettings['updates'][0],
    updatedBy: string
): Promise<void> => {
    const current = await getSystemSettings();
    await updateSystemSettings({
        updates: [...current.updates, update]
    }, updatedBy);
};

/**
 * Add broadcast message
 */
export const addBroadcastMessage = async (
    message: SystemSettings['broadcastMessages'][0],
    updatedBy: string
): Promise<void> => {
    const current = await getSystemSettings();
    await updateSystemSettings({
        broadcastMessages: [...current.broadcastMessages, message]
    }, updatedBy);
};

/**
 * Remove expired broadcast messages
 */
export const cleanExpiredBroadcasts = async (updatedBy: string): Promise<void> => {
    const current = await getSystemSettings();
    const now = new Date();
    const activeMessages = current.broadcastMessages.filter(
        m => m.endDate > now
    );
    
    if (activeMessages.length !== current.broadcastMessages.length) {
        await updateSystemSettings({
            broadcastMessages: activeMessages
        }, updatedBy);
    }
};

/**
 * Check if feature is enabled for tenant
 */
export const isFeatureEnabled = async (
    featureKey: keyof SystemSettings['features'],
    tenantPlan?: 'basic' | 'pro' | 'enterprise',
    forceRefresh: boolean = false
): Promise<boolean> => {
    // ✅ FIX: Force refresh if requested (when feature is toggled)
    const settings = await getSystemSettings(forceRefresh);
    
    // ✅ FIX: Validate feature key exists in settings
    if (!settings.features || typeof settings.features[featureKey] !== 'boolean') {
        console.warn(`⚠️ Feature key "${featureKey}" not found in settings, defaulting to false`);
        return false;
    }
    
    // Check if feature is globally enabled
    if (!settings.features[featureKey]) {
        return false;
    }
    
    // If no plan specified, return global status
    if (!tenantPlan) {
        return settings.features[featureKey] as boolean;
    }
    
    // Check if feature is available in tenant's plan
    const plan = settings.pricingTiers[tenantPlan];
    if (!plan) {
        return false;
    }
    
    // If plan has '*', all features are enabled
    if (plan.features.includes('*')) {
        return true;
    }
    
    // Check if specific feature is in plan
    return plan.features.includes(featureKey as string);
};

/**
 * Get active broadcast messages for tenant
 * ✅ Supports scheduled messages (license expiry reminders)
 */
export const getActiveBroadcasts = async (
    tenantId?: string,
    userRole?: 'owner' | 'manager' | 'employee' | 'staff' | 'admin',
    licenseExpiryDate?: Date
): Promise<SystemSettings['broadcastMessages']> => {
    const settings = await getSystemSettings();
    const now = new Date();
    
    return settings.broadcastMessages.filter(m => {
        // For scheduled messages, check license expiry
        if (m.isScheduled && m.scheduleType === 'license_expiry') {
            if (!licenseExpiryDate || !m.daysBeforeExpiry) {
                return false; // Can't check without expiry date
            }
            
            // Calculate days until expiry
            const daysUntilExpiry = Math.ceil((licenseExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            // Show message if we're within the "daysBeforeExpiry" window
            if (daysUntilExpiry > m.daysBeforeExpiry || daysUntilExpiry < 0) {
                return false; // Too early or already expired
            }
            
            // Check target roles for scheduled messages
            if (m.targetRoles && m.targetRoles.length > 0) {
                if (!userRole) {
                    return false;
                }
                // Map user roles to target roles
                const roleMap: Record<string, ('manager' | 'employee' | 'staff')[]> = {
                    'manager': ['manager'],
                    'employee': ['employee', 'staff'],
                    'staff': ['employee', 'staff'],
                    'admin': ['manager', 'employee', 'staff']
                };
                const userTargetRoles = roleMap[userRole] || [];
                const hasMatchingRole = m.targetRoles.some(tr => userTargetRoles.includes(tr));
                if (!hasMatchingRole) {
                    return false;
                }
            }
            
            // Check tenant targeting for scheduled messages
            if (m.targetTenants && m.targetTenants.length > 0) {
                if (!tenantId) {
                    return false;
                }
                return m.targetTenants.includes(tenantId);
            }
            
            return true; // Scheduled message is active
        }
        
        // Regular messages: Check date range
        if (m.startDate > now || m.endDate < now) {
            return false;
        }
        
        // Check if targeted to specific tenants
        if (m.targetTenants && m.targetTenants.length > 0) {
            if (!tenantId) {
                return false;
            }
            return m.targetTenants.includes(tenantId);
        }
        
        // Broadcast to all
        return true;
    });
};

/**
 * Check if system is in maintenance mode
 */
export const isMaintenanceMode = async (): Promise<{ enabled: boolean; message?: string }> => {
    const settings = await getSystemSettings();
    return {
        enabled: settings.maintenanceMode,
        message: settings.maintenanceMessage
    };
};
