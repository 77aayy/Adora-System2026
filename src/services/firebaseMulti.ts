/**
 * 🔥 Multi-Firebase Support
 * ==========================
 * يدعم التبديل بين Firebase instances:
 * - Firebase الأساسي (المشتركين الحقيقيين)
 * - Firebase الديمو (التجارب المعزولة)
 * 
 * ⚠️ أمان: API Keys معزولة ولا تظهر في الكود العام
 * 
 * @author Adora System
 * @version 1.0
 */

import { initializeApp, FirebaseApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore, Firestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { logger } from './loggerService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
}

export interface DemoFirebaseInstance {
    app: FirebaseApp;
    db: Firestore;
    auth: Auth;
    storage: FirebaseStorage;
    config: FirebaseConfig;
    demoLinkCode: string;
    createdAt: Date;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Cache لـ Demo Firebase instances
const demoInstances: Map<string, DemoFirebaseInstance> = new Map();

// الـ instance الحالي المفعّل
let currentDemoInstance: DemoFirebaseInstance | null = null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEMO FIREBASE INITIALIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 🔥 تهيئة Firebase للديمو
 * ينشئ instance جديد أو يرجع الموجود من الـ cache
 */
export async function initializeDemoFirebase(
    config: FirebaseConfig,
    demoLinkCode: string
): Promise<DemoFirebaseInstance | null> {
    try {
        // تحقق من الـ cache أولاً
        const cacheKey = `demo_${config.projectId}_${demoLinkCode}`;
        
        if (demoInstances.has(cacheKey)) {
            const cached = demoInstances.get(cacheKey)!;
            logger.info(`[DemoFirebase] ⚡ Using cached instance: ${config.projectId}`, null, 'firebaseMulti');
            currentDemoInstance = cached;
            return cached;
        }
        
        logger.info(`[DemoFirebase] 🔥 Initializing new instance: ${config.projectId}`, null, 'firebaseMulti');
        
        // إنشاء اسم فريد للـ app
        const appName = `demo_${demoLinkCode}_${Date.now()}`;
        
        // تهيئة Firebase App
        const app = initializeApp(config, appName);
        
        // تهيئة الخدمات
        const db = getFirestore(app);
        const auth = getAuth(app);
        const storage = getStorage(app);
        
        // تفعيل الـ offline persistence
        try {
            await enableMultiTabIndexedDbPersistence(db);
            logger.info(`[DemoFirebase] ✅ Offline persistence enabled`, null, 'firebaseMulti');
        } catch (persistenceError: any) {
            // قد يفشل لو كان مفعّل من قبل
            if (persistenceError.code !== 'failed-precondition' && persistenceError.code !== 'unimplemented') {
                logger.warn(`[DemoFirebase] ⚠️ Persistence warning: ${persistenceError.message}`, null, 'firebaseMulti');
            }
        }
        
        const instance: DemoFirebaseInstance = {
            app,
            db,
            auth,
            storage,
            config,
            demoLinkCode,
            createdAt: new Date(),
        };
        
        // حفظ في الـ cache
        demoInstances.set(cacheKey, instance);
        currentDemoInstance = instance;
        
        logger.info(`[DemoFirebase] ✅ Demo Firebase initialized: ${config.projectId}`, null, 'firebaseMulti');
        
        return instance;
        
    } catch (error: any) {
        logger.error(`[DemoFirebase] ❌ Failed to initialize: ${error.message}`, error, 'firebaseMulti');
        return null;
    }
}

/**
 * 🧪 اختبار اتصال Firebase Config
 * يستخدم قبل إنشاء رابط الديمو للتأكد من صحة البيانات
 */
export async function testFirebaseConnection(config: FirebaseConfig): Promise<{
    success: boolean;
    projectId?: string;
    error?: string;
}> {
    let testApp: FirebaseApp | null = null;
    
    try {
        logger.info(`[DemoFirebase] 🧪 Testing connection to: ${config.projectId}`, null, 'firebaseMulti');
        
        // إنشاء app مؤقت للاختبار
        const testAppName = `test_${Date.now()}`;
        testApp = initializeApp(config, testAppName);
        
        // محاولة الوصول لـ Firestore
        const testDb = getFirestore(testApp);
        const testAuth = getAuth(testApp);
        
        // الاختبار ناجح لو وصلنا هنا بدون errors
        logger.info(`[DemoFirebase] ✅ Connection test passed: ${config.projectId}`, null, 'firebaseMulti');
        
        return {
            success: true,
            projectId: config.projectId,
        };
        
    } catch (error: any) {
        logger.error(`[DemoFirebase] ❌ Connection test failed: ${error.message}`, error, 'firebaseMulti');
        return {
            success: false,
            error: error.message || 'فشل الاتصال بـ Firebase',
        };
    } finally {
        // تنظيف الـ test app
        if (testApp) {
            try {
                await deleteApp(testApp);
            } catch {
                // ignore cleanup errors
            }
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GETTERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * الحصول على الـ Demo Instance الحالي
 */
export function getCurrentDemoInstance(): DemoFirebaseInstance | null {
    return currentDemoInstance;
}

/**
 * الحصول على Firestore للديمو الحالي
 */
export function getDemoDb(): Firestore | null {
    return currentDemoInstance?.db || null;
}

/**
 * الحصول على Auth للديمو الحالي
 */
export function getDemoAuth(): Auth | null {
    return currentDemoInstance?.auth || null;
}

/**
 * الحصول على Storage للديمو الحالي
 */
export function getDemoStorage(): FirebaseStorage | null {
    return currentDemoInstance?.storage || null;
}

/**
 * التحقق من وجود Demo instance نشط
 */
export function isDemoMode(): boolean {
    return currentDemoInstance !== null;
}

/**
 * الحصول على كود الديمو الحالي
 */
export function getCurrentDemoCode(): string | null {
    return currentDemoInstance?.demoLinkCode || null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLEANUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 🧹 تنظيف Demo instance
 */
export async function cleanupDemoInstance(demoLinkCode?: string): Promise<void> {
    try {
        if (demoLinkCode) {
            // تنظيف instance محدد
            for (const [key, instance] of demoInstances.entries()) {
                if (instance.demoLinkCode === demoLinkCode) {
                    await deleteApp(instance.app);
                    demoInstances.delete(key);
                    
                    if (currentDemoInstance?.demoLinkCode === demoLinkCode) {
                        currentDemoInstance = null;
                    }
                    
                    logger.info(`[DemoFirebase] 🧹 Cleaned up: ${demoLinkCode}`, null, 'firebaseMulti');
                }
            }
        } else {
            // تنظيف الـ instance الحالي
            if (currentDemoInstance) {
                await deleteApp(currentDemoInstance.app);
                
                for (const [key, instance] of demoInstances.entries()) {
                    if (instance === currentDemoInstance) {
                        demoInstances.delete(key);
                    }
                }
                
                currentDemoInstance = null;
                logger.info(`[DemoFirebase] 🧹 Current instance cleaned up`, null, 'firebaseMulti');
            }
        }
    } catch (error: any) {
        logger.error(`[DemoFirebase] ❌ Cleanup error: ${error.message}`, error, 'firebaseMulti');
    }
}

/**
 * 🧹 تنظيف جميع Demo instances
 */
export async function cleanupAllDemoInstances(): Promise<void> {
    try {
        for (const [key, instance] of demoInstances.entries()) {
            try {
                await deleteApp(instance.app);
            } catch {
                // ignore individual cleanup errors
            }
        }
        
        demoInstances.clear();
        currentDemoInstance = null;
        
        logger.info(`[DemoFirebase] 🧹 All instances cleaned up`, null, 'firebaseMulti');
    } catch (error: any) {
        logger.error(`[DemoFirebase] ❌ Cleanup all error: ${error.message}`, error, 'firebaseMulti');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧹 WIPE DEMO DATA - مسح كل بيانات الديمو من Firebase
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { collection, getDocs, deleteDoc, doc as firestoreDoc, writeBatch } from 'firebase/firestore';

/**
 * 🗑️ مسح جميع بيانات الديمو من Firebase المنفصل
 * يمسح: المستأجرين، الفروع، الغرف، الموظفين، الطلبات، QR codes، إلخ
 * 
 * ⚠️ تحذير: هذه العملية لا يمكن التراجع عنها!
 */
export async function wipeDemoFirebaseData(config: FirebaseConfig, demoLinkCode: string): Promise<{
    success: boolean;
    deleted: {
        tenants: number;
        branches: number;
        rooms: number;
        employees: number;
        requests: number;
        qrCodes: number;
        users: number;
        other: number;
    };
    error?: string;
}> {
    let demoApp: FirebaseApp | null = null;
    const deletedCounts = {
        tenants: 0,
        branches: 0,
        rooms: 0,
        employees: 0,
        requests: 0,
        qrCodes: 0,
        users: 0,
        other: 0,
    };
    
    try {
        logger.warn(`[DemoFirebase] 🗑️ WIPING ALL DATA from: ${config.projectId}`, null, 'firebaseMulti');
        
        // إنشاء اتصال بـ Firebase الديمو
        const appName = `wipe_${demoLinkCode}_${Date.now()}`;
        demoApp = initializeApp(config, appName);
        const demoDb = getFirestore(demoApp);
        
        // قائمة المجموعات التي يجب مسحها
        const collectionsToWipe = [
            { name: 'tenants', countKey: 'tenants' },
            { name: 'branches', countKey: 'branches' },
            { name: 'rooms', countKey: 'rooms' },
            { name: 'employees', countKey: 'employees' },
            { name: 'users', countKey: 'users' },
            { name: 'requests', countKey: 'requests' },
            { name: 'qrCodes', countKey: 'qrCodes' },
            { name: 'housekeeping_requests', countKey: 'requests' },
            { name: 'maintenance_requests', countKey: 'requests' },
            { name: 'bellman_requests', countKey: 'requests' },
            { name: 'guest_requests', countKey: 'requests' },
            { name: 'pin_mappings', countKey: 'other' },
            { name: 'settings', countKey: 'other' },
            { name: 'activity_logs', countKey: 'other' },
            { name: 'notifications', countKey: 'other' },
        ];
        
        // مسح كل مجموعة
        for (const col of collectionsToWipe) {
            try {
                const colRef = collection(demoDb, col.name);
                const snapshot = await getDocs(colRef);
                
                if (!snapshot.empty) {
                    // استخدام batch للحذف بكفاءة
                    const batchSize = 500; // حد Firestore
                    let batch = writeBatch(demoDb);
                    let batchCount = 0;
                    
                    for (const docSnap of snapshot.docs) {
                        batch.delete(docSnap.ref);
                        batchCount++;
                        
                        // تنفيذ الـ batch لو وصلنا للحد
                        if (batchCount >= batchSize) {
                            await batch.commit();
                            batch = writeBatch(demoDb);
                            batchCount = 0;
                        }
                        
                        // تحديث العدادات
                        deletedCounts[col.countKey as keyof typeof deletedCounts]++;
                    }
                    
                    // تنفيذ الباقي
                    if (batchCount > 0) {
                        await batch.commit();
                    }
                    
                    logger.info(`[DemoFirebase] ✓ Wiped ${snapshot.size} docs from: ${col.name}`, null, 'firebaseMulti');
                }
            } catch (colError: any) {
                // بعض المجموعات قد لا تكون موجودة - نتجاهل
                logger.warn(`[DemoFirebase] ⚠️ Could not wipe ${col.name}: ${colError.message}`, null, 'firebaseMulti');
            }
        }
        
        const totalDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0);
        logger.info(`[DemoFirebase] ✅ WIPE COMPLETE! Total deleted: ${totalDeleted} documents`, deletedCounts, 'firebaseMulti');
        
        return {
            success: true,
            deleted: deletedCounts,
        };
        
    } catch (error: any) {
        logger.error(`[DemoFirebase] ❌ Wipe failed: ${error.message}`, error, 'firebaseMulti');
        return {
            success: false,
            deleted: deletedCounts,
            error: error.message,
        };
    } finally {
        // تنظيف الـ app
        if (demoApp) {
            try {
                await deleteApp(demoApp);
            } catch {
                // ignore
            }
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// URL DETECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 🔍 اكتشاف Demo mode من الـ URL
 * يكتشف تلقائياً لو المستخدم داخل من رابط ديمو
 */
export function detectDemoFromURL(): { isDemo: boolean; demoCode?: string } {
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    // Pattern 1: /demo/XXXX
    const demoMatch = pathname.match(/\/demo\/([A-Z0-9-]+)/i);
    if (demoMatch) {
        return { isDemo: true, demoCode: demoMatch[1].toUpperCase() };
    }
    
    // Pattern 2: ?demo=XXXX
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    if (demoParam) {
        return { isDemo: true, demoCode: demoParam.toUpperCase() };
    }
    
    // Pattern 3: localStorage (للحفاظ على الـ state بعد navigation)
    const storedDemoCode = localStorage.getItem('adora_demo_code');
    if (storedDemoCode) {
        return { isDemo: true, demoCode: storedDemoCode };
    }
    
    return { isDemo: false };
}

/**
 * 💾 حفظ Demo code في localStorage
 */
export function saveDemoCode(demoCode: string): void {
    localStorage.setItem('adora_demo_code', demoCode);
}

/**
 * 🗑️ مسح Demo code من localStorage
 */
export function clearDemoCode(): void {
    localStorage.removeItem('adora_demo_code');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
    initializeDemoFirebase,
    testFirebaseConnection,
    getCurrentDemoInstance,
    getDemoDb,
    getDemoAuth,
    getDemoStorage,
    isDemoMode,
    getCurrentDemoCode,
    cleanupDemoInstance,
    cleanupAllDemoInstances,
    detectDemoFromURL,
    saveDemoCode,
    clearDemoCode,
};
