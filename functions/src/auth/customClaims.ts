/**
 * Custom Claims Management
 * Sets Firebase Auth Custom Claims for Multi-Tenant Security
 * 
 * هذه الدالة هي "العقل المدبر" للأمان
 * بتطبع "ختم" على كل مستخدم فيه الـ tenantId والـ role
 * الختم ده هو اللي الـ Security Rules بتقرأه
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Types
interface SetClaimsData {
    uid: string;
    tenantId: string;
    role: 'owner' | 'manager' | 'employee' | 'super_admin';
    branchId?: string;
    department?: string;
}

interface ClaimsResponse {
    success: boolean;
    message: string;
    claims?: Record<string, unknown>;
}

/**
 * Set Custom Claims for a User
 * Called when creating or updating user permissions
 */
export const setUserCustomClaims = functions.https.onCall(
    async (data: SetClaimsData, context): Promise<ClaimsResponse> => {
        // 1. Verify the caller is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'لازم تسجل دخول الأول يا هندسة'
            );
        }

        // 2. Verify the caller has permission (owner, manager, or super_admin)
        const callerClaims = context.auth.token;
        const isAuthorized = 
            callerClaims.super_admin === true ||
            callerClaims.role === 'owner' ||
            callerClaims.role === 'manager';

        if (!isAuthorized) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'مش مسموح لك تعدل صلاحيات المستخدمين'
            );
        }

        // 3. Validate input data
        const { uid, tenantId, role, branchId, department } = data;

        if (!uid || !tenantId || !role) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'البيانات ناقصة: uid, tenantId, role مطلوبين'
            );
        }

        // 4. Validate role value
        const validRoles = ['owner', 'manager', 'employee', 'super_admin'];
        if (!validRoles.includes(role)) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `الدور "${role}" مش صحيح. الأدوار المتاحة: ${validRoles.join(', ')}`
            );
        }

        try {
            // 5. Build the custom claims object
            const customClaims: Record<string, unknown> = {
                tenantId: tenantId,
                role: role,
                // Admin flag for Security Rules
                admin: role === 'manager' || role === 'owner',
                // Super Admin flag
                super_admin: role === 'super_admin',
                // Optional: Branch and Department
                ...(branchId && { branchId }),
                ...(department && { department }),
                // Timestamp for tracking
                claimsUpdatedAt: Date.now(),
            };

            // 6. Set the custom claims on the user
            await admin.auth().setCustomUserClaims(uid, customClaims);

            // 7. Log the action for audit
            console.log(`✅ Custom claims set for user ${uid}:`, customClaims);

            return {
                success: true,
                message: `تم تحديث صلاحيات المستخدم ${uid} بنجاح`,
                claims: customClaims,
            };
        } catch (error) {
            console.error('❌ Error setting custom claims:', error);
            throw new functions.https.HttpsError(
                'internal',
                'حصلت مشكلة وأنا بختم الصلاحيات'
            );
        }
    }
);

/**
 * Get User Custom Claims (for debugging/admin)
 */
export const getUserCustomClaims = functions.https.onCall(
    async (data: { uid: string }, context): Promise<ClaimsResponse> => {
        // Verify authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'لازم تسجل دخول الأول'
            );
        }

        // Only super_admin or owner can view others' claims
        const callerClaims = context.auth.token;
        const isAuthorized = 
            callerClaims.super_admin === true ||
            callerClaims.role === 'owner' ||
            context.auth.uid === data.uid; // Can view own claims

        if (!isAuthorized) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'مش مسموح لك تشوف صلاحيات الآخرين'
            );
        }

        try {
            const user = await admin.auth().getUser(data.uid);
            return {
                success: true,
                message: 'تم جلب الصلاحيات بنجاح',
                claims: user.customClaims || {},
            };
        } catch (error) {
            console.error('Error getting user claims:', error);
            throw new functions.https.HttpsError(
                'not-found',
                'المستخدم غير موجود'
            );
        }
    }
);

/**
 * Revoke User Custom Claims (for security emergencies)
 */
export const revokeUserClaims = functions.https.onCall(
    async (data: { uid: string }, context): Promise<ClaimsResponse> => {
        // Only super_admin can revoke claims
        if (!context.auth || context.auth.token.super_admin !== true) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'فقط السوبر أدمن يقدر يسحب الصلاحيات'
            );
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
        } catch (error) {
            console.error('Error revoking claims:', error);
            throw new functions.https.HttpsError(
                'internal',
                'فشل سحب الصلاحيات'
            );
        }
    }
);
