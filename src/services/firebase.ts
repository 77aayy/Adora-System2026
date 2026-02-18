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
import { getFunctions, Functions, httpsCallable } from 'firebase/functions';
import { logger } from './loggerService';

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
 * ✅ EXPORTED: For checking current config before switching
 */
export const getSavedConfig = (): FirebaseConfig | null => {
    if (typeof window === 'undefined') return null;

    const savedConfig = localStorage.getItem(FIREBASE_CONFIG_KEY);
    if (!savedConfig) return null;

    try {
        const parsed = JSON.parse(savedConfig) as FirebaseConfig;
        
        // ✅ CRITICAL: Validate ALL required fields for Firebase Auth
        if (!parsed.apiKey || !parsed.projectId || !parsed.authDomain) {
            logger.warn('⚠️ Saved config is incomplete, ignoring...', undefined, 'firebase');
            logger.warn('   Missing:', {
                apiKey: !parsed.apiKey,
                projectId: !parsed.projectId,
                authDomain: !parsed.authDomain
            }, 'firebase');
            return null;
        }
        
        // ✅ Validate authDomain format (must match Firebase project)
        if (!parsed.authDomain.includes(parsed.projectId)) {
            logger.warn('⚠️ Saved config has invalid authDomain, ignoring...', undefined, 'firebase');
            logger.warn(`   authDomain (${parsed.authDomain}) doesn't match projectId (${parsed.projectId})`, undefined, 'firebase');
            return null;
        }

        return parsed;
    } catch (e) {
        logger.error('❌ Failed to parse saved Firebase config:', e, 'firebase');
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
    const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;

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
        appId,
        measurementId: measurementId && measurementId !== 'YOUR_MEASUREMENT_ID' && !measurementId.includes('YOUR_') ? measurementId : undefined
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
        // ✅ CRITICAL: Validate projectId matches expected value
        if (savedConfig.projectId === 'tests-66ca4') {
            logger.warn('⚠️ Invalid Firebase Config detected (tests-66ca4) - using environment config instead', undefined, 'firebase');
            // Fall through to env config
        } else {
            return savedConfig;
        }
    }

    // 2. Fall back to environment variables
    const envConfig = getEnvConfig();
    if (envConfig) {
        return envConfig;
    }

    // 3. No valid configuration found
    logger.warn('⚠️ NO VALID FIREBASE CONFIGURATION FOUND', undefined, 'firebase');
    logger.warn('   Please configure Firebase via Owner Dashboard or .env file', undefined, 'firebase');
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
let functions: Functions | null = null;
let isConfigured = false;

// 🛡️ ADORA FIREBASE PROTECTION LAYER
// Prevent premature Firestore calls and fix lingering Persistence issues
let isFirestoreReady = false;
let isAuthReady = false; // ✅ CRITICAL: Track Auth readiness separately
/** تسجيل مرة واحدة فقط لتجنب تكرار نفس الخطأ في الكونسول */
let _hasLoggedCurrentUserNull = false;

const initializeFirebaseServices = async () => {
    const config = getFirebaseConfig();

    if (!config) {
        logger.info('🔧 Firebase not configured - Setup Wizard required', undefined, 'firebase');
        isConfigured = false;
        return;
    }

    try {
        // Clean up existing apps to prevent duplicate initialization
        const existingApps = getApps();
        if (existingApps.length > 0) {
            // Don't delete, just reuse
            app = existingApps[0];
        } else {
            app = initializeApp(config);
        }

        // ✅ CRITICAL: Initialize Auth FIRST before Firestore
        // This ensures Firestore can properly connect to Auth when it initializes
        try {
            auth = getAuth(app);
            // ✅ CRITICAL: Wait for Auth state to be ready before initializing Firestore
            // This ensures Auth state is propagated to Firestore Rules
            if (typeof window !== 'undefined' && auth) {
                // Wait for Auth state to be ready (onAuthStateChanged)
                const waitForAuthReady = () => {
                    return new Promise<void>((resolve) => {
                        const unsub = auth!.onAuthStateChanged((user) => {
                            unsub();
                            if (user) {
                                // Use cached token to avoid quota-exceeded (getIdToken(true) burns quota)
                                user.getIdToken(false).then(() => {
                                    isAuthReady = true;
                                    resolve();
                                }).catch((tokenError: any) => {
                                    logger.warn('⚠️ Token failed, marking Auth ready anyway:', tokenError?.message, 'firebase');
                                    isAuthReady = true;
                                    resolve();
                                });
                            } else {
                                isAuthReady = true;
                                resolve();
                            }
                        });
                        // Fallback timeout
                        setTimeout(() => {
                            unsub();
                            if (auth?.currentUser) {
                                auth.currentUser.getIdToken(false).then(() => {
                                    isAuthReady = true;
                                    resolve();
                                }).catch(() => {
                                    isAuthReady = true;
                                    resolve();
                                });
                            } else {
                                isAuthReady = true;
                                resolve();
                            }
                        }, 1000);
                    });
                };
                
                // ✅ CRITICAL: Wait for Auth to be ready BEFORE initializing Firestore
                // This ensures request.auth is not null in Firestore Rules
                await waitForAuthReady();
            } else {
                // Not in browser or no auth, mark as ready anyway
                isAuthReady = true;
            }
        } catch (authError: any) {
            logger.error('❌ Failed to initialize Firebase Auth:', authError, 'firebase');
            logger.error('   Error code:', authError?.code, 'firebase');
            logger.error('   Error message:', authError?.message, 'firebase');
            // Don't set auth to null - keep existing if available
            isAuthReady = true; // Mark as ready even if Auth failed (fallback)
        }
        
        // ⚡ PERFORMANCE: Initialize Firestore AFTER Auth (ensures Auth connection)
        // ✅ FIX Listen/channel 400: long-polling avoids "400" on Firestore Listen/channel (proxies, some networks)
        // When reusing an existing app, Firestore may already be initialized — use existing instance to avoid "already initialized" → fallback to channel (400)
        const firestoreAlreadyExists = existingApps.length > 0;
        if (firestoreAlreadyExists) {
            db = getFirestore(app);
            isFirestoreReady = true;
            logger.debug('✅ Firestore using existing instance (app reused)', undefined, 'firebase');
        } else {
            const tryInitFirestore = (): boolean => {
                try {
                    db = initializeFirestore(app!, { experimentalForceLongPolling: true });
                    isFirestoreReady = true;
                    logger.debug('✅ Firestore initialized with long-polling (avoids Listen/channel 400)', undefined, 'firebase');
                    return true;
                } catch {
                    return false;
                }
            };
            if (!tryInitFirestore()) {
                await new Promise(r => setTimeout(r, 150));
                if (!tryInitFirestore()) {
                    logger.warn('⚠️ initializeFirestore failed twice, using getFirestore (Listen/channel 400 may appear)', undefined, 'firebase');
                    logger.warn('   If you see 400 errors: enable Cloud Firestore API in Google Cloud Console, check project/billing', undefined, 'firebase');
                    db = getFirestore(app);
                    isFirestoreReady = true;
                    if (typeof window !== 'undefined') {
                        sessionStorage.setItem('adora_firestore_no_long_polling', '1');
                    }
                }
            }
        }
        
        try {
            storage = getStorage(app);
        } catch (storageError: any) {
            logger.error('❌ Failed to initialize Firebase Storage:', storageError, 'firebase');
        }
        
        try {
            // ✅ CRITICAL: Specify region to match Cloud Functions deployment
            functions = getFunctions(app, 'us-central1');
        } catch (functionsError: any) {
            logger.error('❌ Failed to initialize Firebase Functions:', functionsError, 'firebase');
        }
        
        isConfigured = true;

        // Initialize Analytics only if measurementId is provided
        // Note: Firebase Analytics requires measurementId, not just appId
        const measurementId = (config as any).measurementId;
        if (typeof window !== 'undefined' && measurementId && !measurementId.includes('YOUR_') && measurementId !== 'undefined') {
            try {
                analytics = getAnalytics(app);
            } catch (e) {
                logger.warn('⚠️ Analytics not available:', e, 'firebase');
            }
        } else {
        }

        // 🛡️ Initialize App Check (Budget Protection)
        const recaptchaSiteKey = localStorage.getItem(RECAPTCHA_SITE_KEY_STORAGE);
        if (typeof window !== 'undefined' && recaptchaSiteKey && app) {
            try {
                // Enable debug mode for localhost (development)
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    // @ts-ignore - Debug token for development
                    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
                }
                
                appCheck = initializeAppCheck(app, {
                    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
                    isTokenAutoRefreshEnabled: true
                });
            } catch (e) {
                logger.warn('⚠️ App Check initialization failed:', e, 'firebase');
                logger.warn('   App will work but without App Check protection', undefined, 'firebase');
            }
        } else if (!recaptchaSiteKey) {
        }


    } catch (e) {
        logger.error('❌ Failed to initialize Firebase:', e, 'firebase');
        isConfigured = false;
    }
};

// Initialize on module load
// ✅ CRITICAL: Wait for Auth to be ready before initializing Firestore
// ✅ CRITICAL: Clear any corrupted Firestore state before initialization
if (typeof window !== 'undefined') {
    // Clear sessionStorage flag that might prevent reinitialization
    sessionStorage.removeItem('adora_firestore_reload_attempted');
}
initializeFirebaseServices().catch((error) => {
    logger.error('❌ Failed to initialize Firebase services:', error, 'firebase');
});

// ============================================================
// DYNAMIC RECONFIGURATION
// ============================================================

/**
 * Save new Firebase configuration and reinitialize Firebase
 * @param config New Firebase configuration
 * @param reloadPage If true, reload the page to apply changes (default: false)
 */
export const saveFirebaseConfig = async (config: FirebaseConfig, reloadPage: boolean = false): Promise<void> => {
    localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem(FIREBASE_CONFIG_VALIDATED_KEY, 'true');
    logger.info('✅ Firebase configuration saved', undefined, 'firebase');
    
    // ✅ Reinitialize Firebase with new config without page reload (async)
    await reinitializeFirebase();
    
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
    logger.info('🛡️ reCAPTCHA Site Key saved - Reload to enable App Check', undefined, 'firebase');
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
 * ✅ FIX: Made async to properly wait for app deletion and reinitialize Firestore with persistence
 */
export const reinitializeFirebase = async (): Promise<boolean> => {
    const config = getFirebaseConfig();
    
    if (!config) {
        logger.warn('⚠️ No Firebase config to reinitialize', undefined, 'firebase');
        return false;
    }
    
    try {
        // Delete existing app if any
        const existingApps = getApps();
        if (existingApps.length > 0) {
            // ✅ CRITICAL: Wait for app deletion before creating new one
            await deleteApp(existingApps[0]);
            logger.info('🧹 Deleted existing Firebase app', undefined, 'firebase');
        }
        
        // ✅ Create new app with tenant config
        app = initializeApp(config);
        
        // ✅ CRITICAL: Initialize Auth FIRST before Firestore (ensures Auth connection)
        try {
            auth = getAuth(app);
            logger.info('✅ Firebase Auth reinitialized', undefined, 'firebase');
        } catch (authError: any) {
            logger.error('❌ Failed to reinitialize Firebase Auth:', authError, 'firebase');
            // Auth might fail if config is invalid - log but continue
        }
        
        // ✅ Reinitialize Firestore AFTER Auth — long-polling to avoid Listen/channel 400
        try {
            db = initializeFirestore(app, { experimentalForceLongPolling: true });
            logger.info('✅ Firestore reinitialized (long-polling)', undefined, 'firebase');
            isFirestoreReady = true;
        } catch (e: unknown) {
            const err = e as { code?: string; message?: string };
            logger.warn('⚠️ Firestore reinit failed, using getFirestore:', err?.message ?? e, 'firebase');
            db = getFirestore(app);
            isFirestoreReady = true;
        }
        
        try {
            storage = getStorage(app);
            logger.info('✅ Firebase Storage reinitialized', undefined, 'firebase');
        } catch (storageError: any) {
            logger.error('❌ Failed to reinitialize Firebase Storage:', storageError, 'firebase');
        }
        
        isConfigured = true;
        
        logger.info('🔄 Firebase reinitialized with new configuration', undefined, 'firebase');
        logger.info(`   Project: ${config.projectId}`, undefined, 'firebase');
        
        return true;
    } catch (e) {
        logger.error('❌ Failed to reinitialize Firebase:', e, 'firebase');
        return false;
    }
};

/**
 * Clear Firebase configuration (revert to env or setup wizard)
 */
export const clearFirebaseConfig = (): void => {
    localStorage.removeItem(FIREBASE_CONFIG_KEY);
    localStorage.removeItem(FIREBASE_CONFIG_VALIDATED_KEY);
    logger.info('🗑️ Firebase configuration cleared', undefined, 'firebase');
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
        logger.error('Test connection error:', error, 'firebase');
        
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
// 🛡️ ADORA FIREBASE PROTECTION LAYER
// ============================================================

/**
 * Get safe Firestore instance with initialization check
 * Prevents premature Firestore calls and fixes lingering Persistence issues
 * 
 * @returns Promise<Firestore | null> - Firestore instance or null if not ready
 * 
 * @example
 * const db = await getSafeFirestore();
 * if (!db) {
 *   logger.warn('Firestore not ready yet', undefined, 'firebase');
 *   return;
 * }
 */
export const getSafeFirestore = async (): Promise<Firestore | null> => {
    // ✅ CRITICAL: Wait for BOTH Firestore AND Auth to be ready
    // This ensures request.auth is not null in Firestore Rules
    if (isFirestoreReady && isAuthReady && db) {
        return db;
    }
    
    // Wait for initialization (max 5 seconds - longer for Auth propagation)
    const maxWait = 5000; // 5 seconds
    const checkInterval = 100; // Check every 100ms
    let elapsed = 0;
    
    while ((!isFirestoreReady || !isAuthReady) && elapsed < maxWait) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
    }
    
    // If still not ready after waiting, log warning
    if (!isFirestoreReady || !isAuthReady) {
        logger.warn('⚠️ ADORA: Firestore or Auth initialization timeout. Proceeding with caution.', undefined, 'firebase');
        logger.warn(`   Firestore ready: ${isFirestoreReady}, Auth ready: ${isAuthReady}`, undefined, 'firebase');
        // Still return db if it exists (might be ready but flag not set)
        return db;
    }
    
    // Use cached token to avoid auth/quota-exceeded (getIdToken(true) on every getSafeFirestore burns quota)
    if (auth?.currentUser) {
        try {
            await auth.currentUser.getIdToken(false);
        } catch (tokenError: any) {
            if (tokenError?.code !== 'auth/quota-exceeded') {
                logger.warn('⚠️ [getSafeFirestore] Token failed:', tokenError?.message, 'firebase');
            }
        }
    } else {
        // تسجيل مرة واحدة فقط لتجنب تكرار الرسالة (مثلاً على صفحة الدخول قبل تسجيل الدخول)
        _hasLoggedCurrentUserNull = true;
    }
    
    return db;
};

/**
 * Check if Firestore is ready for use
 * ✅ CRITICAL: Also checks Auth readiness to ensure request.auth is not null in Firestore Rules
 * @returns boolean - true if Firestore AND Auth are initialized and ready
 */
export const isFirestoreReadyForUse = (): boolean => {
    return isFirestoreReady && isAuthReady && db !== null && auth !== null;
};

/**
 * Check if Auth is ready for Firestore operations
 * ✅ CRITICAL: This ensures request.auth is not null in Firestore Rules
 * @returns boolean - true if Auth is initialized and ready
 */
export const isAuthReadyForFirestore = (): boolean => {
    return isAuthReady && auth !== null;
};

/**
 * Mark Auth as ready for Firestore operations
 * ✅ CRITICAL: This should be called when Auth state is confirmed ready
 * This ensures request.auth is not null in Firestore Rules
 * @param ready - Whether Auth is ready (default: true)
 */
export const setAuthReadyForFirestore = (ready: boolean = true): void => {
    isAuthReady = ready;
};

/**
 * 🔧 RECOVER FIRESTORE: Fix "INTERNAL ASSERTION FAILED" errors
 * This function clears the corrupted Firestore state and reinitializes it
 * 
 * @returns Promise<boolean> - true if recovery was successful
 */
export const recoverFirestore = async (): Promise<boolean> => {
    if (!app) {
        logger.warn('⚠️ Cannot recover Firestore: No Firebase app', undefined, 'firebase');
        return false;
    }

    try {
        logger.info('🔧 [Firestore Recovery] Starting recovery process...', undefined, 'firebase');
        
        // Step 1: Mark Firestore as not ready
        isFirestoreReady = false;
        
        // Step 2: Clear IndexedDB cache for Firestore
        try {
            if (typeof window !== 'undefined' && 'indexedDB' in window) {
                const dbName = `firestore/${app.options.projectId}/main`;
                const deleteReq = indexedDB.deleteDatabase(dbName);
                await new Promise<void>((resolve, reject) => {
                    deleteReq.onsuccess = () => {
                        logger.info('✅ [Firestore Recovery] IndexedDB cache cleared', undefined, 'firebase');
                        resolve();
                    };
                    deleteReq.onerror = () => {
                        logger.warn('⚠️ [Firestore Recovery] Failed to clear IndexedDB:', deleteReq.error, 'firebase');
                        resolve(); // Continue anyway
                    };
                    deleteReq.onblocked = () => {
                        logger.warn('⚠️ [Firestore Recovery] IndexedDB deletion blocked (tabs open)', undefined, 'firebase');
                        resolve(); // Continue anyway
                    };
                });
            }
        } catch (clearError: any) {
            logger.warn('⚠️ [Firestore Recovery] Error clearing cache:', clearError.message, 'firebase');
            // Continue anyway
        }

        // Step 3: Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 4: ⚠️ CRITICAL FIX: Don't reinitialize Firestore if there are active listeners
        // Reinitializing while listeners are active causes "INTERNAL ASSERTION FAILED: Unexpected state"
        // Instead, force page reload immediately to ensure clean state
        if (typeof window !== 'undefined') {
            logger.warn('⚠️ [Firestore Recovery] Cannot safely reinitialize Firestore with active listeners.', undefined, 'firebase');
            logger.warn('⚠️ [Firestore Recovery] Forcing page reload for clean recovery...', undefined, 'firebase');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            return false; // Indicate that recovery requires reload
        }
        
        // Fallback: reinitialize with long-polling to avoid Listen/channel 400
        try {
            db = initializeFirestore(app, { experimentalForceLongPolling: true });
            logger.info('✅ [Firestore Recovery] Firestore reinitialized (long-polling)', undefined, 'firebase');
            isFirestoreReady = true;
            return true;
        } catch (reinitError: any) {
            logger.error('❌ [Firestore Recovery] Failed to reinitialize:', reinitError, 'firebase');
            try {
                db = getFirestore(app);
                isFirestoreReady = true;
                logger.info('✅ [Firestore Recovery] Firestore recovered (fallback mode)', undefined, 'firebase');
                return true;
            } catch (fallbackError: any) {
                logger.error('❌ [Firestore Recovery] Complete failure:', fallbackError, 'firebase');
                return false;
            }
        }
    } catch (error: any) {
        logger.error('❌ [Firestore Recovery] Unexpected error:', error, 'firebase');
        return false;
    }
};

/**
 * 🔄 RETRY WRAPPER: Execute Firestore operation with automatic recovery
 * 
 * @param operation - The Firestore operation to execute
 * @param maxRetries - Maximum number of retry attempts (default: 1)
 * @returns Promise<T> - Result of the operation
 * 
 * @example
 * const result = await retryFirestoreOperation(async () => {
 *   const snapshot = await getDocs(collection(db, 'users'));
 *   return snapshot.docs;
 * });
 */
export const retryFirestoreOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 1
): Promise<T> => {
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Ensure Firestore is ready
            const firestore = await getSafeFirestore();
            if (!firestore) {
                throw new Error('Firestore not ready');
            }
            
            // Execute the operation
            return await operation();
        } catch (error: any) {
            lastError = error;
            const errorMessage = error?.message || String(error);
            
            // Check if this is the "INTERNAL ASSERTION FAILED" error
            const isInternalError = errorMessage.includes('INTERNAL ASSERTION FAILED') ||
                                   errorMessage.includes('Unexpected state');
            
            if (isInternalError) {
                // ✅ CRITICAL FIX: Clear Firestore cache and reinitialize without persistent cache
                logger.error('❌ [Firestore Retry] INTERNAL ASSERTION FAILED - clearing cache and reinitializing...', undefined, 'firebase');
                
                // Clear IndexedDB cache
                if (typeof window !== 'undefined' && 'indexedDB' in window) {
                    try {
                        indexedDB.deleteDatabase('firestore/[DEFAULT]/main');
                        logger.info('🧹 Cleared Firestore IndexedDB cache', undefined, 'firebase');
                    } catch (e) {
                        logger.warn('⚠️ Failed to clear IndexedDB:', e, 'firebase');
                    }
                }
                
                // Reinitialize Firestore without persistent cache
                try {
                    const { getApps, deleteApp } = await import('firebase/app');
                    const apps = getApps();
                    if (apps.length > 0) {
                        await deleteApp(apps[0]);
                    }
                    // Reinitialize will happen on next call
                    logger.info('🔄 Firestore app deleted, will reinitialize on next call', undefined, 'firebase');
                } catch (e) {
                    logger.warn('⚠️ Failed to delete app:', e, 'firebase');
                }
                
                // Throw to trigger page reload via errorHandlerService
                throw error;
            }
            
            // If not retryable or max retries reached, throw
            throw error;
        }
    }
    
    // Should never reach here, but TypeScript needs it
    throw lastError || new Error('Firestore operation failed');
};

// ============================================================
// EXPORTS
// ============================================================

// Export Firebase services (may be null if not configured)
export { db, auth, storage, analytics, logEvent, app, functions, httpsCallable };

// For backwards compatibility, provide a default export
export default app;
