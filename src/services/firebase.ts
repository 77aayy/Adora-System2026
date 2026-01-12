/**
 * Firebase Configuration & Initialization
 * Adora Hotel Management System V3
 * 
 * 🔐 SECURITY: NO HARDCODED KEYS
 * All configuration comes from:
 * 1. Environment variables (.env)
 * 2. localStorage (adora_client_config) for tenant-specific Firebase
 * 
 * 🏢 SaaS Architecture:
 * - Master Instance: Used for license validation only
 * - Client Instance: Each tenant can have their own Firebase project
 */

import { initializeApp, FirebaseApp, deleteApp, getApps } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, logEvent, Analytics } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';

// ============================================================
// CONFIGURATION STORAGE KEY
// ============================================================

export const FIREBASE_CONFIG_KEY = 'adora_client_config';
export const FIREBASE_CONFIG_VALIDATED_KEY = 'adora_config_validated';
export const RECAPTCHA_SITE_KEY_STORAGE = 'adora_recaptcha_site_key';

// ============================================================
// TYPES
// ============================================================

export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId?: string;
    appId?: string;
    measurementId?: string;
}

// ============================================================
// CONFIGURATION LOADING
// ============================================================

/**
 * Get Firebase config from localStorage (tenant-specific)
 * Returns null if not configured
 */
const getSavedConfig = (): FirebaseConfig | null => {
    if (typeof window === 'undefined') return null;

    const savedConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (!savedConfig) return null;

    try {
        const parsed = JSON.parse(savedConfig) as FirebaseConfig;
        
        // Validate required fields
        if (!parsed.apiKey || !parsed.projectId || !parsed.authDomain) {
            console.warn('⚠️ Saved config is incomplete, ignoring...');
            return null;
        }

        return parsed;
    } catch (e) {
        console.error('❌ Failed to parse saved Firebase config:', e);
        return null;
    }
};

/**
 * Get Firebase config from environment variables
 * Returns null if required vars are missing
 */
const getEnvConfig = (): FirebaseConfig | null => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
    const appId = import.meta.env.VITE_FIREBASE_APP_ID;

    // All required fields must be present (not empty placeholders)
    if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.includes('YOUR_')) return null;
    if (!projectId || projectId === 'YOUR_PROJECT_ID' || projectId.includes('YOUR_')) return null;
    if (!authDomain || authDomain === 'YOUR_AUTH_DOMAIN' || authDomain.includes('YOUR_')) return null;

    return {
        apiKey,
        authDomain,
        projectId,
        storageBucket: storageBucket || `${projectId}.appspot.com`,
        messagingSenderId,
        appId
    };
};

/**
 * Get the final Firebase configuration
 * Priority: localStorage > env variables > null (requires setup)
 */
const getFirebaseConfig = (): FirebaseConfig | null => {
    // 1. Check localStorage first (tenant-specific override)
    const savedConfig = getSavedConfig();
    if (savedConfig) {
        console.log('🏢 Using TENANT-SPECIFIC Firebase configuration');
        return savedConfig;
    }

    // 2. Fall back to environment variables
    const envConfig = getEnvConfig();
    if (envConfig) {
        console.log('🌐 Using ENVIRONMENT Firebase configuration');
        return envConfig;
    }

    // 3. No valid configuration found
    console.warn('⚠️ NO VALID FIREBASE CONFIGURATION FOUND');
    console.warn('   Please configure Firebase via Owner Dashboard or .env file');
    return null;
};

// ============================================================
// INITIALIZATION
// ============================================================

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;
let storage: FirebaseStorage | null = null;
let analytics: Analytics | null = null;
let appCheck: AppCheck | null = null;
let isConfigured = false;

const initializeFirebaseServices = () => {
    const config = getFirebaseConfig();

    if (!config) {
        console.log('🔧 Firebase not configured - Setup Wizard required');
        isConfigured = false;
        return;
    }

    try {
        // Clean up existing apps to prevent duplicate initialization
        const existingApps = getApps();
        if (existingApps.length > 0) {
            console.log('🧹 Cleaning up existing Firebase apps...');
            // Don't delete, just reuse
            app = existingApps[0];
        } else {
            app = initializeApp(config);
        }

        // ⚡ PERFORMANCE: Initialize Firestore with optimal cache settings
        try {
            // Try modern persistence API first (Firebase v10+)
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager(),
                    cacheSizeBytes: CACHE_SIZE_UNLIMITED
                })
            });
            console.log('✅ Firestore initialized with persistent multi-tab cache (unlimited)');
        } catch (e: any) {
            // Fallback to legacy persistence if modern API fails
            if (e.code === 'failed-precondition' || e.message?.includes('already been called')) {
                db = getFirestore(app);
                console.log('ℹ️ Using existing Firestore instance');
            } else {
                db = getFirestore(app);
                // Enable legacy offline persistence
                enableIndexedDbPersistence(db, {
                    forceOwnership: false
                }).then(() => {
                    console.log('✅ Offline persistence enabled (legacy mode)');
                }).catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('⚠️ Multiple tabs open - persistence active in another tab');
                    } else if (err.code === 'unimplemented') {
                        console.warn('⚠️ Browser does not support IndexedDB');
                    } else {
                        console.error('❌ Error enabling persistence:', err);
                    }
                });
            }
        }
        
        auth = getAuth(app);
        storage = getStorage(app);
        isConfigured = true;

        // Initialize Analytics only if measurementId is provided
        // Note: Firebase Analytics requires measurementId, not just appId
        const measurementId = (config as any).measurementId;
        if (typeof window !== 'undefined' && measurementId && !measurementId.includes('YOUR_') && measurementId !== 'undefined') {
            try {
                analytics = getAnalytics(app);
                console.log('📊 Analytics initialized with measurement ID');
            } catch (e) {
                console.warn('⚠️ Analytics not available:', e);
            }
        } else {
            console.log('ℹ️ Analytics not configured - measurementId not provided');
        }

        // 🛡️ Initialize App Check (Budget Protection)
        const recaptchaSiteKey = localStorage.getItem(RECAPTCHA_SITE_KEY_STORAGE);
        if (typeof window !== 'undefined' && recaptchaSiteKey && app) {
            try {
                // Enable debug mode for localhost (development)
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    // @ts-ignore - Debug token for development
                    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                    console.log('🛡️ App Check: Debug mode enabled for localhost');
                }
                
                appCheck = initializeAppCheck(app, {
                    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
                    isTokenAutoRefreshEnabled: true
                });
                console.log('🛡️ App Check initialized - Budget Protected!');
            } catch (e) {
                console.warn('⚠️ App Check initialization failed:', e);
                console.warn('   App will work but without App Check protection');
            }
        } else if (!recaptchaSiteKey) {
            console.log('ℹ️ App Check not configured - To enable, add reCAPTCHA Site Key in Firebase Setup');
        }

        console.log('✅ Firebase initialized successfully');
        console.log(`   Project: ${config.projectId}`);

    } catch (e) {
        console.error('❌ Failed to initialize Firebase:', e);
        isConfigured = false;
    }
};

// Initialize on module load
initializeFirebaseServices();

// ============================================================
// DYNAMIC RECONFIGURATION
// ============================================================

/**
 * Save new Firebase configuration and reinitialize Firebase
 * @param config New Firebase configuration
 * @param reloadPage If true, reload the page to apply changes (default: false)
 */
export const saveFirebaseConfig = (config: FirebaseConfig, reloadPage: boolean = false): void => {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem(FIREBASE_CONFIG_VALIDATED_KEY, 'true');
    console.log('✅ Firebase configuration saved');
    
    // Reinitialize Firebase with new config without page reload
    reinitializeFirebase();
    
    if (reloadPage) {
        window.location.reload();
    }
};

/**
 * Save reCAPTCHA Site Key for App Check
 * @param siteKey The reCAPTCHA v3 Site Key from Google reCAPTCHA Admin
 */
export const saveRecaptchaSiteKey = (siteKey: string): void => {
    localStorage.setItem(RECAPTCHA_SITE_KEY_STORAGE, siteKey);
    console.log('🛡️ reCAPTCHA Site Key saved - Reload to enable App Check');
};

/**
 * Get saved reCAPTCHA Site Key
 */
export const getRecaptchaSiteKey = (): string | null => {
    return localStorage.getItem(RECAPTCHA_SITE_KEY_STORAGE);
};

/**
 * Check if App Check is enabled
 */
export const isAppCheckEnabled = (): boolean => {
    return appCheck !== null;
};

/**
 * Reinitialize Firebase services with current config
 * Called after saving new configuration
 */
export const reinitializeFirebase = (): boolean => {
    const config = getFirebaseConfig();
    
    if (!config) {
        console.warn('⚠️ No Firebase config to reinitialize');
        return false;
    }
    
    try {
        // Delete existing app if any
        const existingApps = getApps();
        if (existingApps.length > 0) {
            // We need to delete and recreate to apply new config
            deleteApp(existingApps[0]).then(() => {
                const newApp = initializeApp(config);
                app = newApp;
                db = getFirestore(newApp);
                auth = getAuth(newApp);
                storage = getStorage(newApp);
                isConfigured = true;
                console.log('🔄 Firebase reinitialized with new configuration');
            }).catch(err => {
                console.error('❌ Error reinitializing Firebase:', err);
            });
        } else {
            app = initializeApp(config);
            db = getFirestore(app);
            auth = getAuth(app);
            storage = getStorage(app);
            isConfigured = true;
            console.log('✅ Firebase initialized with new configuration');
        }
        
        return true;
    } catch (e) {
        console.error('❌ Failed to reinitialize Firebase:', e);
        return false;
    }
};

/**
 * Clear Firebase configuration (revert to env or setup wizard)
 */
export const clearFirebaseConfig = (): void => {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    localStorage.removeItem(FIREBASE_CONFIG_VALIDATED_KEY);
    console.log('🗑️ Firebase configuration cleared');
};

/**
 * Check if Firebase is configured and ready
 */
export const isFirebaseConfigured = (): boolean => {
    return isConfigured && db !== null;
};

/**
 * 🔐 Check if Anonymous Authentication is enabled
 * This is CRITICAL for the app to work!
 * Returns: { enabled: boolean, error?: string }
 */
export const checkAnonymousAuthEnabled = async (): Promise<{ enabled: boolean; error?: string }> => {
    if (!auth) {
        return { enabled: false, error: 'Firebase Auth غير مهيأ' };
    }
    
    try {
        // Import signInAnonymously
        const { signInAnonymously, signOut } = await import('firebase/auth');
        
        // Try to sign in anonymously
        const credential = await signInAnonymously(auth);
        
        // Success! Sign out to clean up
        if (credential.user) {
            await signOut(auth);
            return { enabled: true };
        }
        
        return { enabled: false, error: 'فشل إنشاء مستخدم مجهول' };
    } catch (error: any) {
        // Check specific error codes
        if (error.code === 'auth/operation-not-allowed') {
            return { 
                enabled: false, 
                error: '❌ Anonymous Auth غير مفعل!\n\n' +
                       '📍 الحل:\n' +
                       'Firebase Console → Authentication → Sign-in method → Anonymous → Enable ✅'
            };
        }
        
        if (error.code === 'auth/network-request-failed') {
            return { enabled: false, error: 'لا يوجد اتصال بالإنترنت' };
        }
        
        return { enabled: false, error: error.message || 'خطأ غير معروف' };
    }
};

/**
 * Check if a custom tenant config exists
 */
export const hasTenantConfig = (): boolean => {
    return getSavedConfig() !== null;
};

/**
 * Get current Firebase configuration (for display in settings)
 * Returns masked sensitive values
 */
export const getCurrentConfig = (): Partial<FirebaseConfig> | null => {
    const config = getFirebaseConfig();
    if (!config) return null;

    return {
        apiKey: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : undefined,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
    };
};

/**
 * Get full config (internal use only - for testing connection)
 */
export const getFullConfig = (): FirebaseConfig | null => {
    return getFirebaseConfig();
};

// ============================================================
// TEST CONNECTION
// ============================================================

// ============================================================
// ARABIC ERROR MESSAGE HELPERS
// ============================================================

/**
 * Get Arabic translation for Firebase Auth errors
 */
const getArabicAuthError = (code: string): string => {
    const authErrors: Record<string, string> = {
        'auth/invalid-api-key': 'مفتاح API غير صالح',
        'auth/app-deleted': 'تم حذف التطبيق',
        'auth/invalid-user-token': 'رمز المستخدم غير صالح',
        'auth/network-request-failed': 'فشل طلب الشبكة',
        'auth/operation-not-allowed': 'العملية غير مسموحة',
        'auth/requires-recent-login': 'يتطلب تسجيل دخول حديث',
        'auth/too-many-requests': 'عدد طلبات كثيرة، حاول لاحقاً',
        'auth/user-disabled': 'حساب المستخدم معطل',
        'auth/user-not-found': 'المستخدم غير موجود',
        'auth/wrong-password': 'كلمة المرور خاطئة',
    };
    return authErrors[code] || code.replace('auth/', '');
};

/**
 * Get Arabic translation for Firestore errors
 */
const getArabicFirestoreError = (code: string): string => {
    const firestoreErrors: Record<string, string> = {
        'firestore/permission-denied': 'صلاحيات غير كافية',
        'firestore/unavailable': 'الخدمة غير متاحة',
        'firestore/cancelled': 'تم إلغاء العملية',
        'firestore/unknown': 'خطأ غير معروف',
        'firestore/invalid-argument': 'قيمة غير صالحة',
        'firestore/deadline-exceeded': 'انتهت مهلة الطلب',
        'firestore/not-found': 'المستند غير موجود',
        'firestore/already-exists': 'المستند موجود بالفعل',
        'firestore/resource-exhausted': 'تم استنفاد الموارد',
        'firestore/failed-precondition': 'شرط مسبق فاشل',
        'firestore/aborted': 'تم إلغاء العملية',
        'firestore/out-of-range': 'القيمة خارج النطاق',
        'firestore/unimplemented': 'غير مدعوم',
        'firestore/internal': 'خطأ داخلي',
        'firestore/data-loss': 'فقدان بيانات',
        'firestore/unauthenticated': 'غير مصادق عليه',
    };
    return firestoreErrors[code] || code.replace('firestore/', '');
};

/**
 * Test Firebase connection with given configuration
 * Creates a temporary app instance, tries to read, then cleans up
 */
export const testFirebaseConnection = async (config: FirebaseConfig): Promise<{ 
    success: boolean; 
    message: string;
    projectId?: string;
}> => {
    let testApp: FirebaseApp | null = null;

    try {
        // Validate config fields
        if (!config.apiKey || !config.projectId || !config.authDomain) {
            return {
                success: false,
                message: '❌ الحقول المطلوبة غير مكتملة (API Key, Project ID, Auth Domain)'
            };
        }

        // Create a test app instance
        testApp = initializeApp(config, `testInstance_${Date.now()}`);
        const testDb = getFirestore(testApp);

        // Try to read from a known collection
        const { collection, getDocs, limit, query } = await import('firebase/firestore');
        
        // Try to access any collection (this will fail with invalid credentials)
        const testQuery = query(collection(testDb, 'health_check'), limit(1));
        await getDocs(testQuery);

        // If we get here, connection is successful
        return {
            success: true,
            message: '✅ تم التحقق من الاتصال بنجاح!',
            projectId: config.projectId
        };

    } catch (error: any) {
        console.error('Test connection error:', error);
        
        const errorCode = error.code || '';
        const errorMessage = error.message || '';

        // ✅ Comprehensive Arabic error messages
        const errorMappings: Array<{
            check: () => boolean;
            message: string;
            isSuccess?: boolean;
        }> = [
            // Permission denied - connection works but rules deny access (OK for new project)
            {
                check: () => errorCode === 'permission-denied' || errorMessage.includes('permission'),
                message: '✅ الاتصال ناجح! (قد تحتاج لتحديث Security Rules من Firebase Console)',
                isSuccess: true
            },
            // Network errors
            {
                check: () => errorCode === 'unavailable' || errorMessage.includes('network') || errorMessage.includes('offline'),
                message: '❌ فشل الاتصال بالشبكة - تأكد من اتصال الإنترنت ثم حاول مرة أخرى'
            },
            // Invalid API Key
            {
                check: () => errorMessage.toLowerCase().includes('invalid') && errorMessage.toLowerCase().includes('api'),
                message: '❌ مفتاح API غير صحيح - تأكد من نسخه كاملاً من Firebase Console > Project Settings > Web App'
            },
            {
                check: () => errorMessage.includes('API key not valid'),
                message: '❌ مفتاح API غير صالح - ادخل على Firebase Console وتأكد أن المفتاح مفعّل'
            },
            // Wrong Project ID
            {
                check: () => errorMessage.includes('project') && (errorMessage.includes('not found') || errorMessage.includes('does not exist')),
                message: '❌ المشروع غير موجود - تأكد من كتابة Project ID بشكل صحيح (بدون مسافات)'
            },
            // Auth Domain issues
            {
                check: () => errorMessage.includes('auth') && errorMessage.includes('domain'),
                message: '❌ Auth Domain غير صحيح - يجب أن يكون بصيغة: your-project-id.firebaseapp.com'
            },
            // CORS / Web App not configured
            {
                check: () => errorMessage.includes('CORS') || errorMessage.includes('blocked'),
                message: '❌ خطأ CORS - تأكد من إضافة دومين موقعك في Firebase Console > Authentication > Settings > Authorized domains'
            },
            // Quota exceeded
            {
                check: () => errorMessage.includes('quota') || errorMessage.includes('exceeded'),
                message: '❌ تم تجاوز حد الاستخدام المجاني - راجع خطة Firebase الخاصة بك'
            },
            // App ID issues
            {
                check: () => errorMessage.includes('app') && errorMessage.includes('not found'),
                message: '❌ App ID غير صحيح - تأكد من نسخه من Firebase Console > Project Settings > Your apps'
            },
            // Generic Firebase errors
            {
                check: () => errorCode.startsWith('auth/'),
                message: `❌ خطأ في المصادقة: ${getArabicAuthError(errorCode)}`
            },
            {
                check: () => errorCode.startsWith('firestore/'),
                message: `❌ خطأ في قاعدة البيانات: ${getArabicFirestoreError(errorCode)}`
            }
        ];

        // Find matching error
        for (const mapping of errorMappings) {
            if (mapping.check()) {
                if (mapping.isSuccess) {
                    return {
                        success: true,
                        message: mapping.message,
                        projectId: config.projectId
                    };
                }
                return {
                    success: false,
                    message: mapping.message
                };
            }
        }

        // Default error message
        return {
            success: false,
            message: `❌ فشل الاتصال: ${errorMessage || 'خطأ غير معروف'}\n\n💡 تأكد من:\n• صحة مفاتيح Firebase\n• اتصال الإنترنت\n• تفعيل Firestore في المشروع`
        };

    } finally {
        // Clean up test app
        if (testApp) {
            try {
                await deleteApp(testApp);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
};

// ============================================================
// EXPORTS
// ============================================================

// Export Firebase services (may be null if not configured)
export { db, auth, storage, analytics, logEvent, app };

// For backwards compatibility, provide a default export
export default app;
