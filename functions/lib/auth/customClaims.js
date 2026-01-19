"use strict";
/**
 * Custom Claims Management
 * Sets Firebase Auth Custom Claims for Multi-Tenant Security
 *
 * هذه الدالة هي "العقل المدبر" للأمان
 * بتطبع "ختم" على كل مستخدم فيه الـ tenantId والـ role
 * الختم ده هو اللي الـ Security Rules بتقرأه
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
exports.revokeUserClaims = exports.getUserCustomClaims = exports.setUserCustomClaims = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Set Custom Claims for a User
 * Called when creating or updating user permissions
 */
exports.setUserCustomClaims = functions.https.onCall(async (data, context) => {
    // 1. Verify the caller is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'لازم تسجل دخول الأول يا هندسة');
    }
    // 2. Verify the caller has permission (owner, manager, or super_admin)
    const callerClaims = context.auth.token;
    const isAuthorized = callerClaims.super_admin === true ||
        callerClaims.role === 'owner' ||
        callerClaims.role === 'manager';
    if (!isAuthorized) {
        throw new functions.https.HttpsError('permission-denied', 'مش مسموح لك تعدل صلاحيات المستخدمين');
    }
    // 3. Validate input data
    const { uid, tenantId, role, branchId, department } = data;
    if (!uid || !tenantId || !role) {
        throw new functions.https.HttpsError('invalid-argument', 'البيانات ناقصة: uid, tenantId, role مطلوبين');
    }
    // 4. Validate role value
    const validRoles = ['owner', 'manager', 'employee', 'super_admin'];
    if (!validRoles.includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', `الدور "${role}" مش صحيح. الأدوار المتاحة: ${validRoles.join(', ')}`);
    }
    try {
        // 5. Build the custom claims object
        const customClaims = Object.assign(Object.assign(Object.assign({ tenantId: tenantId, role: role, 
            // Admin flag for Security Rules
            admin: role === 'manager' || role === 'owner', 
            // Super Admin flag
            super_admin: role === 'super_admin' }, (branchId && { branchId })), (department && { department })), { 
            // Timestamp for tracking
            claimsUpdatedAt: Date.now() });
        // 6. Set the custom claims on the user
        await admin.auth().setCustomUserClaims(uid, customClaims);
        // 7. Log the action for audit
        console.log(`✅ Custom claims set for user ${uid}:`, customClaims);
        return {
            success: true,
            message: `تم تحديث صلاحيات المستخدم ${uid} بنجاح`,
            claims: customClaims,
        };
    }
    catch (error) {
        console.error('❌ Error setting custom claims:', error);
        throw new functions.https.HttpsError('internal', 'حصلت مشكلة وأنا بختم الصلاحيات');
    }
});
/**
 * Get User Custom Claims (for debugging/admin)
 */
exports.getUserCustomClaims = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'لازم تسجل دخول الأول');
    }
    // Only super_admin or owner can view others' claims
    const callerClaims = context.auth.token;
    const isAuthorized = callerClaims.super_admin === true ||
        callerClaims.role === 'owner' ||
        context.auth.uid === data.uid; // Can view own claims
    if (!isAuthorized) {
        throw new functions.https.HttpsError('permission-denied', 'مش مسموح لك تشوف صلاحيات الآخرين');
    }
    try {
        const user = await admin.auth().getUser(data.uid);
        return {
            success: true,
            message: 'تم جلب الصلاحيات بنجاح',
            claims: user.customClaims || {},
        };
    }
    catch (error) {
        console.error('Error getting user claims:', error);
        throw new functions.https.HttpsError('not-found', 'المستخدم غير موجود');
    }
});
/**
 * Revoke User Custom Claims (for security emergencies)
 */
exports.revokeUserClaims = functions.https.onCall(async (data, context) => {
    // Only super_admin can revoke claims
    if (!context.auth || context.auth.token.super_admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'فقط السوبر أدمن يقدر يسحب الصلاحيات');
    }
    try {
        // Set empty claims to revoke all permissions
        await admin.auth().setCustomUserClaims(data.uid, {
            revoked: true,
            revokedAt: Date.now(),
            revokedBy: context.auth.uid,
        });
        // Also revoke refresh tokens to force re-authentication
        await admin.auth().revokeRefreshTokens(data.uid);
        console.log(`⚠️ Claims revoked for user ${data.uid} by ${context.auth.uid}`);
        return {
            success: true,
            message: 'تم سحب جميع الصلاحيات من المستخدم',
        };
    }
    catch (error) {
        console.error('Error revoking claims:', error);
        throw new functions.https.HttpsError('internal', 'فشل سحب الصلاحيات');
    }
});
//# sourceMappingURL=customClaims.js.map