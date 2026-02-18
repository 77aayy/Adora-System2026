/**
 * System Settings Service
 * Centralized system-wide settings management for SaaS owner
 * Allows owner to control global settings that affect all tenants
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, getSafeFirestore } from './firebase';
import { logger } from './loggerService';

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
    twoYearDiscountRate?: number; // ✅ Discount percentage for 2-year subscriptions (e.g. 5, 10)
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
    
    // ✅ Developer Branding (for copyright signature and support links)
    developerBranding?: {
        devPhoneSA?: string; // WhatsApp Saudi Arabia
        devPhoneEG?: string; // WhatsApp Egypt
        devEmail?: string; // Developer email
        devName?: string; // Developer/Company name
        devSignature?: string; // Copyright signature text
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
    const localData = (typeof window !== 'undefined' && window.localStorage) ? localStorage.getItem(localKey) : null;
    const localSettings = localData ? JSON.parse(localData) : null;
    
    // ✅ NEW: Try Cloud Function first (bypasses client Rules)
    // ✅ FIX: Skip Cloud Function if CORS error detected (use Firestore directly)
    const corsFailed = typeof window !== 'undefined' && sessionStorage.getItem('adora_cloud_functions_cors_failed') === 'true';
    if (!corsFailed) {
        try {
            const { functions, httpsCallable } = await import('./firebase');
            if (functions) {
                const getSettingsFunction = httpsCallable(functions, 'getSystemSettings');
                // ✅ Add timeout to prevent hanging on CORS errors
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Function call timeout (likely CORS)')), 5000)
                );
                const result = await Promise.race([
                    getSettingsFunction({}),
                    timeoutPromise
                ]) as any;
                const response = result.data as any;

                if (response.success && response.settings) {
                    const firebaseSettings = {
                        ...DEFAULT_SETTINGS,
                        ...response.settings,
                        updates: response.settings.updates?.map((u: any) => ({
                            ...u,
                            releaseDate: u.releaseDate?.toDate ? new Date(u.releaseDate.toDate()) : new Date()
                        })) || [],
                        broadcastMessages: response.settings.broadcastMessages?.map((m: any) => ({
                            ...m,
                            startDate: m.startDate?.toDate ? new Date(m.startDate.toDate()) : new Date(),
                            endDate: m.endDate?.toDate ? new Date(m.endDate.toDate()) : new Date()
                        })) || []
                    } as SystemSettings;
                    
                    // ✅ Sync Firebase data to localStorage for offline access
                    if (typeof window !== 'undefined' && window.localStorage) {
                        localStorage.setItem(localKey, JSON.stringify(firebaseSettings));
                    }
                    return firebaseSettings;
                }
            }
        } catch (functionError: any) {
            // ✅ FIX: Detect CORS errors and skip Cloud Function permanently for this session
            const isCORSError = functionError?.message?.includes('CORS') || 
                               functionError?.code === 'functions/internal' ||
                               functionError?.message?.includes('blocked by CORS');
            if (isCORSError) {
                logger.warn('⚠️ [systemSettingsService] CORS error detected, skipping Cloud Function for this session', undefined, 'systemSettingsService');
                // Mark CORS as failed in sessionStorage to skip future attempts
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem('adora_cloud_functions_cors_failed', 'true');
                }
            } else {
                logger.warn('Cloud Function getSystemSettings failed, using fallback:', functionError.message, 'systemSettingsService');
            }
            // Fall through to Firestore fallback
        }
    }
    
    // ✅ Fallback: Direct Firestore read (if Functions not available)
    try {
        // ✅ CRITICAL: Use getSafeFirestore to ensure Auth is ready
        const safeDb = await getSafeFirestore();
        if (!safeDb) {
            logger.debug('Firebase not initialized, returning local/default settings', undefined, 'systemSettingsService');
            return localSettings ? { ...DEFAULT_SETTINGS, ...localSettings } : DEFAULT_SETTINGS;
        }
        
        // ✅ CRITICAL: Verify auth state before making Firestore request
        const { auth } = await import('./firebase');
        if (!auth?.currentUser) {
            return localSettings ? { ...DEFAULT_SETTINGS, ...localSettings } : DEFAULT_SETTINGS;
        }
        
        // Use cached token to avoid burning Auth quota (getIdToken(true) causes quota-exceeded on Spark)
        try {
            await auth.currentUser.getIdToken(false);
        } catch (tokenError: any) {
            if (tokenError?.code === 'auth/quota-exceeded') {
                logger.warn('⚠️ [systemSettingsService] Auth quota exceeded, using cached settings', undefined, 'systemSettingsService');
            } else {
                logger.error('❌ [systemSettingsService] Token failed:', tokenError?.message, 'systemSettingsService');
            }
            return localSettings ? { ...DEFAULT_SETTINGS, ...localSettings } : DEFAULT_SETTINGS;
        }
        
        const docRef = doc(safeDb, SYSTEM_SETTINGS_PATH);
        
        // ✅ CRITICAL: Log auth state before Firestore request
        logger.debug('🔍 [systemSettingsService] Before Firestore read:', {
            uid: auth.currentUser?.uid,
            isAnonymous: auth.currentUser?.isAnonymous,
            hasToken: !!auth.currentUser
        });
        
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
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(localKey, JSON.stringify(firebaseSettings));
            }
            return firebaseSettings;
        }
        
        // If no settings exist in Firebase, try to create from localStorage
        if (localSettings) {
            logger.info('📦 No Firebase settings, using localStorage', undefined, 'systemSettingsService');
            return { ...DEFAULT_SETTINGS, ...localSettings };
        }
        
        // If no settings exist anywhere, return defaults (don't create via client)
        return DEFAULT_SETTINGS;
    } catch (error: any) {
        const isChannelError = error?.code === 400 || error?.code === 404 ||
            error?.message?.includes('400') || error?.message?.includes('Listen/channel') || error?.message?.includes('Write/channel');
        if (isChannelError) {
            logger.debug('System settings: Listen/Write channel error, using local/default', undefined, 'systemSettingsService');
        } else if (error?.message?.includes('INTERNAL ASSERTION FAILED')) {
            logger.warn('Firestore internal error in _fetchSystemSettings (likely cache issue)', error, 'systemSettingsService');
        } else {
            if (!error?.message?.includes('permission')) {
                logger.error('Error getting system settings:', error, 'systemSettingsService');
            }
        }
        // ✅ FIX: Return localStorage settings on Firebase error (not defaults!)
        if (localSettings) {
            logger.info('📦 Firebase error, using localStorage backup (price=' + localSettings.defaultSubscriptionPrice + ')', undefined, 'systemSettingsService');
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
        let merged: any = null;
        if (typeof window !== 'undefined' && window.localStorage) {
            const localKey = 'adora_system_settings';
            const existing = localStorage.getItem(localKey);
            const currentLocal = existing ? JSON.parse(existing) : {};
            merged = { ...currentLocal, ...sanitizedUpdates, updatedAt: new Date().toISOString(), updatedBy };
            localStorage.setItem(localKey, JSON.stringify(merged));
        }
        
        // 🔍 DEBUG: Log what we're saving
        if (merged) {
            logger.info('💾 updateSystemSettings: price=' + (sanitizedUpdates as any).defaultSubscriptionPrice + 
                       ', merged_price=' + merged.defaultSubscriptionPrice);
        }
        
        // ✅ CRITICAL: Use getSafeFirestore to ensure Auth is ready
        const safeDb = await getSafeFirestore();
        if (!safeDb) {
            logger.warn('Firebase not initialized, settings saved to localStorage only', undefined, 'systemSettingsService');
            return; // ✅ Don't throw - localStorage backup worked
        }
        
        const docRef = doc(safeDb, SYSTEM_SETTINGS_PATH);
        
        // ✅ CRITICAL: Get current document first to merge properly
        const currentDoc = await getDoc(docRef);
        const currentData = currentDoc.exists() ? currentDoc.data() : {};
        
        // ✅ CRITICAL: Deep merge developerBranding to avoid overwriting other fields
        const mergedUpdates = { ...sanitizedUpdates };
        if (sanitizedUpdates.developerBranding && currentData.developerBranding) {
            mergedUpdates.developerBranding = {
                ...currentData.developerBranding,
                ...sanitizedUpdates.developerBranding
            };
        }
        
        // ✅ FIX: Use setDoc with merge:true to CREATE if not exists, UPDATE if exists
        // updateDoc fails if document doesn't exist!
        await setDoc(docRef, {
            ...mergedUpdates,
            updatedAt: serverTimestamp(),
            updatedBy
        }, { merge: true });
        
        // ✅ CRITICAL: Also update localStorage system_settings immediately
        if (typeof window !== 'undefined' && window.localStorage) {
            const localKey = 'adora_system_settings';
            const existingLocal = localStorage.getItem(localKey);
            const currentLocal = existingLocal ? JSON.parse(existingLocal) : {};
            const updatedLocal = {
                ...currentLocal,
                ...mergedUpdates,
                updatedAt: new Date().toISOString(),
                updatedBy
            };
            localStorage.setItem(localKey, JSON.stringify(updatedLocal));
        }
        
        logger.info('✅ Settings saved to Firebase successfully', { developerBranding: mergedUpdates.developerBranding }, 'systemSettingsService');
    } catch (error) {
        logger.error('Error updating system settings in Firebase:', error, 'systemSettingsService');
        // ✅ Don't throw - localStorage backup already saved
        logger.info('Settings saved to localStorage as fallback', undefined, 'systemSettingsService');
    }
};

/**
 * Set system settings (only accessible by owner) - Creates if doesn't exist
 */
export const setSystemSettings = async (settings: SystemSettings): Promise<void> => {
    try {
        // ✅ CRITICAL: Use getSafeFirestore to ensure Auth is ready
        const safeDb = await getSafeFirestore();
        if (!safeDb) {
            throw new Error('Firestore not ready. Please wait and try again.');
        }
        const docRef = doc(safeDb, SYSTEM_SETTINGS_PATH);
        await setDoc(docRef, {
            ...settings,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        logger.error('Error setting system settings:', error, 'systemSettingsService');
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
        logger.warn('Could not invalidate cache:', err, 'systemSettingsService');
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
        logger.warn(`⚠️ Feature key "${featureKey}" not found in settings, defaulting to false`, undefined, 'systemSettingsService');
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
