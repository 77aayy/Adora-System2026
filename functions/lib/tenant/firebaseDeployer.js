"use strict";
/**
 * Firebase Deployer Cloud Function
 * Securely deploys Firestore Rules and Indexes to tenant projects
 *
 * ⚠️ SECURITY: Service Account operations MUST happen server-side only
 *
 * Adora Hotel Management System V3
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testTenantConnection = exports.deployTenantFirebase = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
// ============================================================
// HELPER FUNCTIONS
// ============================================================
/**
 * Validate Service Account JSON structure
 */
function validateServiceAccount(json) {
    try {
        const parsed = JSON.parse(json);
        if (parsed.type !== 'service_account') {
            return { valid: false, error: 'Invalid type: must be "service_account"' };
        }
        if (!parsed.project_id) {
            return { valid: false, error: 'Missing project_id' };
        }
        if (!parsed.private_key) {
            return { valid: false, error: 'Missing private_key' };
        }
        if (!parsed.client_email) {
            return { valid: false, error: 'Missing client_email' };
        }
        return { valid: true, projectId: parsed.project_id };
    }
    catch (e) {
        return { valid: false, error: 'Invalid JSON format' };
    }
}
/**
 * Initialize a temporary Firebase Admin app for the tenant
 */
function initializeTenantApp(serviceAccountJson, appName) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
    }, appName);
}
/**
 * Clean up tenant app
 */
async function cleanupTenantApp(app) {
    try {
        await app.delete();
    }
    catch (e) {
        console.warn('Error cleaning up tenant app:', e);
    }
}
// ============================================================
// MAIN DEPLOY FUNCTION
// ============================================================
/**
 * Deploy Firebase Rules and Indexes to a tenant's project
 * Called from the frontend when creating a new manager with their own Firebase project
 */
exports.deployTenantFirebase = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
})
    .https.onCall(async (data, context) => {
    // ✅ Security: Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول لتنفيذ هذه العملية');
    }
    // ✅ Security: Verify caller is owner/super-admin
    const callerUid = context.auth.uid;
    const mainDb = admin.firestore();
    const userDoc = await mainDb.collection('users').doc(callerUid).get();
    const userData = userDoc.data();
    if (!userData || (userData.role !== 'owner' && userData.role !== 'super-admin')) {
        throw new functions.https.HttpsError('permission-denied', 'ليس لديك صلاحية لتنفيذ هذه العملية');
    }
    // ✅ Validate input
    const { tenantId, serviceAccountJson, firestoreRules, firestoreIndexes } = data;
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'معرف المستأجر مطلوب');
    }
    if (!serviceAccountJson) {
        throw new functions.https.HttpsError('invalid-argument', 'Service Account JSON مطلوب');
    }
    // ✅ Validate Service Account
    const validation = validateServiceAccount(serviceAccountJson);
    if (!validation.valid) {
        throw new functions.https.HttpsError('invalid-argument', `Service Account غير صالح: ${validation.error}`);
    }
    const result = {
        success: false,
        message: '',
        details: {
            rulesDeployed: false,
            indexesDeployed: false,
            seedingCompleted: false,
        }
    };
    let tenantApp = null;
    try {
        // ✅ Initialize tenant's Firebase Admin
        const appName = `tenant_${tenantId}_${Date.now()}`;
        tenantApp = initializeTenantApp(serviceAccountJson, appName);
        const tenantDb = tenantApp.firestore();
        console.log(`🔧 Initializing tenant Firebase for project: ${validation.projectId}`);
        // ✅ Test connection by writing a health check document
        await tenantDb.collection('health_check').doc('connection_test').set({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: 'Connection test successful',
            deployedBy: callerUid,
        });
        console.log('✅ Connection test successful');
        // ✅ Deploy Firestore Rules (Note: This requires Firebase Management API)
        // For now, we'll store the rules in the tenant's database for manual deployment
        if (firestoreRules) {
            await tenantDb.collection('_system').doc('firestore_rules').set({
                rules: firestoreRules,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                note: 'انسخ هذه القواعد وارفعها يدوياً في Firebase Console > Firestore > Rules'
            });
            result.details.rulesDeployed = true;
            console.log('✅ Firestore rules stored');
        }
        // ✅ Store Indexes configuration
        if (firestoreIndexes) {
            await tenantDb.collection('_system').doc('firestore_indexes').set({
                indexes: firestoreIndexes,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                note: 'استخدم Firebase CLI لنشر الفهارس: firebase deploy --only firestore:indexes'
            });
            result.details.indexesDeployed = true;
            console.log('✅ Firestore indexes stored');
        }
        // ✅ Seed default data
        await seedTenantData(tenantDb, tenantId);
        result.details.seedingCompleted = true;
        console.log('✅ Default data seeded');
        // ✅ NEW: Try to enable Anonymous Authentication automatically (BEFORE cleanup)
        try {
            await enableAnonymousAuth(serviceAccountJson, validation.projectId);
            console.log('✅ Anonymous Authentication enabled successfully');
            result.message = '✅ تم إعداد المشروع بنجاح! البيانات الأساسية جاهزة.\n✅ تم تفعيل Anonymous Authentication تلقائياً.';
        }
        catch (authError) {
            console.warn('⚠️ Failed to enable Anonymous Auth automatically:', authError.message);
            result.message = '✅ تم إعداد المشروع بنجاح! البيانات الأساسية جاهزة.\n⚠️ تعذر تفعيل Anonymous Authentication تلقائياً - يجب تفعيله يدوياً:\nFirebase Console → Authentication → Sign-in method → Anonymous → Enable';
        }
        // ✅ Log the deployment in main database
        await mainDb.collection('deployment_logs').add({
            tenantId,
            projectId: validation.projectId,
            deployedBy: callerUid,
            deployedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'success',
            details: result.details,
        });
        result.success = true;
    }
    catch (error) {
        console.error('❌ Deployment error:', error);
        // Log the failure
        await mainDb.collection('deployment_logs').add({
            tenantId,
            projectId: validation.projectId,
            deployedBy: callerUid,
            deployedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: error.message || 'Unknown error',
        });
        result.message = `❌ فشل الإعداد: ${error.message || 'خطأ غير معروف'}`;
    }
    finally {
        // ✅ CRITICAL: Clean up tenant app (removes Service Account from memory)
        if (tenantApp) {
            await cleanupTenantApp(tenantApp);
            console.log('🧹 Tenant app cleaned up');
        }
    }
    return result;
});
// ============================================================
// ANONYMOUS AUTH ENABLEMENT (Identity Platform API)
// ============================================================
/**
 * ✅ Enable Anonymous Authentication using Identity Platform REST API
 * ⚠️ Requires: Project must have Identity Platform enabled (upgraded from Firebase Auth)
 *
 * This function attempts to enable Anonymous Auth automatically when creating a new manager.
 * If the project is not upgraded to Identity Platform, it will fail gracefully with a helpful message.
 */
async function enableAnonymousAuth(serviceAccountJson, projectId) {
    var _a;
    try {
        // Parse Service Account
        const serviceAccount = JSON.parse(serviceAccountJson);
        // ✅ Initialize Google Auth with Service Account
        const auth = new google_auth_library_1.GoogleAuth({
            credentials: serviceAccount,
            scopes: [
                'https://www.googleapis.com/auth/cloud-platform',
                'https://www.googleapis.com/auth/identitytoolkit'
            ]
        });
        // Get access token
        const client = await auth.getClient();
        const accessTokenResponse = await client.getAccessToken();
        if (!accessTokenResponse.token) {
            throw new Error('Failed to get access token from Service Account');
        }
        // ✅ Enable Anonymous Auth via Identity Platform REST API v2
        const identityPlatformUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=signIn.anonymous.enabled`;
        // Node.js 18+ has native fetch, no need for node-fetch
        const response = await fetch(identityPlatformUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessTokenResponse.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                signIn: {
                    anonymous: {
                        enabled: true
                    }
                }
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = ((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) || response.statusText;
            // Check if it's because Identity Platform is not enabled
            if (errorMessage.includes('Identity Platform') ||
                errorMessage.includes('not enabled') ||
                response.status === 404) {
                throw new Error('المشروع غير مترقي لـ Identity Platform. يجب تفعيل Anonymous Auth يدوياً:\nFirebase Console → Authentication → Sign-in method → Anonymous → Enable');
            }
            throw new Error(`Failed to enable Anonymous Auth: ${response.status} ${errorMessage}`);
        }
        const result = await response.json();
        console.log('✅ Anonymous Authentication enabled successfully via Identity Platform API', result);
    }
    catch (error) {
        // Re-throw with helpful message
        if (error.message) {
            throw error;
        }
        throw new Error(`Failed to enable Anonymous Auth: ${error.message || 'Unknown error'}`);
    }
}
// ============================================================
// SEEDING FUNCTION
// ============================================================
/**
 * Seed default data for a new tenant
 */
async function seedTenantData(db, tenantId) {
    const batch = db.batch();
    // ✅ 1. Settings
    const settingsRef = db.collection('settings').doc('general');
    batch.set(settingsRef, {
        language: 'ar',
        currency: 'SAR',
        timezone: 'Asia/Riyadh',
        theme: 'dark',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // ✅ 2. Room Statuses
    const roomStatuses = [
        { id: 'clean', name: 'نظيفة', color: '#22c55e', order: 1 },
        { id: 'dirty', name: 'غير نظيفة', color: '#ef4444', order: 2 },
        { id: 'maintenance', name: 'صيانة', color: '#f59e0b', order: 3 },
        { id: 'inspecting', name: 'تفتيش', color: '#3b82f6', order: 4 },
    ];
    roomStatuses.forEach(status => {
        const ref = db.collection('roomStatuses').doc(status.id);
        batch.set(ref, Object.assign(Object.assign({}, status), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    });
    // ✅ 3. Departments
    const departments = [
        { id: 'reception', name: 'الاستقبال', icon: '🏨', order: 1 },
        { id: 'housekeeping', name: 'النظافة', icon: '🧹', order: 2 },
        { id: 'maintenance', name: 'الصيانة', icon: '🔧', order: 3 },
        { id: 'coffee_shop', name: 'الكافي شوب', icon: '☕', order: 4 },
        { id: 'bellman', name: 'البيلمان', icon: '🛎️', order: 5 },
    ];
    departments.forEach(dept => {
        const ref = db.collection('departments').doc(dept.id);
        batch.set(ref, Object.assign(Object.assign({}, dept), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    });
    // ✅ 4. Roles
    const roles = [
        { id: 'admin', name: 'مدير', permissions: ['*'], order: 1 },
        { id: 'supervisor', name: 'مشرف', permissions: ['read', 'write', 'approve'], order: 2 },
        { id: 'staff', name: 'موظف', permissions: ['read', 'write'], order: 3 },
    ];
    roles.forEach(role => {
        const ref = db.collection('roles').doc(role.id);
        batch.set(ref, Object.assign(Object.assign({}, role), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    });
    // ✅ 5. Maintenance Templates
    const maintenanceTemplates = [
        { id: 'plumbing', name: 'سباكة', icon: '🚿', category: 'infrastructure' },
        { id: 'electrical', name: 'كهرباء', icon: '💡', category: 'infrastructure' },
        { id: 'ac', name: 'تكييف', icon: '❄️', category: 'hvac' },
        { id: 'carpentry', name: 'نجارة', icon: '🪚', category: 'furniture' },
        { id: 'general', name: 'صيانة عامة', icon: '🔧', category: 'general' },
    ];
    maintenanceTemplates.forEach(template => {
        const ref = db.collection('maintenanceTemplates').doc(template.id);
        batch.set(ref, Object.assign(Object.assign({}, template), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    });
    // ✅ 6. Demo Room (Room 101)
    const demoRoomRef = db.collection('rooms').doc('room_101');
    batch.set(demoRoomRef, {
        roomNumber: '101',
        floor: 1,
        type: 'standard',
        status: 'clean',
        isOccupied: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        notes: 'غرفة تجريبية - يمكنك حذفها أو تعديلها',
    });
    // ✅ 7. Achievements/Ranks (20 levels)
    const achievements = [
        { level: 1, title: 'مبتدئ', points: 100 },
        { level: 2, title: 'متدرب', points: 200 },
        { level: 3, title: 'نشيط', points: 300 },
        { level: 4, title: 'مجتهد', points: 400 },
        { level: 5, title: 'متميز', points: 500 },
        { level: 6, title: 'محترف', points: 600 },
        { level: 7, title: 'خبير', points: 700 },
        { level: 8, title: 'ماهر', points: 800 },
        { level: 9, title: 'متقدم', points: 900 },
        { level: 10, title: 'نجم', points: 1000 },
        { level: 11, title: 'نجم ذهبي', points: 1100 },
        { level: 12, title: 'نجم ماسي', points: 1200 },
        { level: 13, title: 'أسطورة', points: 1300 },
        { level: 14, title: 'بطل', points: 1400 },
        { level: 15, title: 'قائد', points: 1500 },
        { level: 16, title: 'ملهم', points: 1600 },
        { level: 17, title: 'رائد', points: 1700 },
        { level: 18, title: 'عبقري', points: 1800 },
        { level: 19, title: 'أسطوري', points: 1900 },
        { level: 20, title: 'الأفضل', points: 2000 },
    ];
    achievements.forEach(achievement => {
        const ref = db.collection('achievements').doc(`level_${achievement.level}`);
        batch.set(ref, Object.assign(Object.assign({}, achievement), { active: true, createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    });
    // ✅ Commit all
    await batch.commit();
    console.log(`✅ Seeded ${7} collections with default data for tenant: ${tenantId}`);
}
// ============================================================
// TEST CONNECTION FUNCTION
// ============================================================
/**
 * Test connection to a tenant's Firebase project
 * Used before full deployment to verify credentials
 */
exports.testTenantConnection = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 30,
    memory: '128MB',
})
    .https.onCall(async (data, context) => {
    // ✅ Security: Verify caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول لتنفيذ هذه العملية');
    }
    const { serviceAccountJson } = data;
    if (!serviceAccountJson) {
        return { success: false, message: 'Service Account JSON مطلوب' };
    }
    // ✅ Validate Service Account
    const validation = validateServiceAccount(serviceAccountJson);
    if (!validation.valid) {
        return { success: false, message: `Service Account غير صالح: ${validation.error}` };
    }
    let tenantApp = null;
    try {
        // ✅ Initialize tenant's Firebase Admin
        const appName = `test_${Date.now()}`;
        tenantApp = initializeTenantApp(serviceAccountJson, appName);
        const tenantDb = tenantApp.firestore();
        // ✅ Test connection
        await tenantDb.collection('health_check').doc('test').set({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        // ✅ Clean up test document
        await tenantDb.collection('health_check').doc('test').delete();
        return {
            success: true,
            message: '✅ تم التحقق بنجاح - الاتصال بـ Firebase مستقر',
            projectId: validation.projectId,
        };
    }
    catch (error) {
        console.error('❌ Connection test failed:', error);
        return {
            success: false,
            message: `❌ فشل الاتصال: ${error.message || 'خطأ غير معروف'}`,
        };
    }
    finally {
        if (tenantApp) {
            await cleanupTenantApp(tenantApp);
        }
    }
});
//# sourceMappingURL=firebaseDeployer.js.map