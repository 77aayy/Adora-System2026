/**
 * ✅ Cloud Function: createUserBinding
 * Creates userBinding for owner using Admin SDK (bypasses client Rules)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface CreateUserBindingRequest {
  uid: string;
  role: string;
  tenantId: string;
  userId: string;
}

interface CreateUserBindingResponse {
  success: boolean;
  error?: string;
}

/**
 * ✅ Create userBinding via Cloud Function (Admin SDK - bypasses client Rules)
 * ✅ CORS enabled for localhost development
 */
export const createUserBinding = functions
  .region('us-central1')
  .https.onCall(
    async (data: CreateUserBindingRequest, context): Promise<CreateUserBindingResponse> => {
    try {
      // ✅ Security: Verify user is authenticated
      if (!context.auth) {
        return {
          success: false,
          error: 'Unauthorized - must be authenticated'
        };
      }

      const { uid, role, tenantId, userId } = data;

      if (!uid || !role || !tenantId) {
        return {
          success: false,
          error: 'Missing required fields: uid, role, tenantId'
        };
      }

      // ✅ Security: Only allow creating binding for own UID
      if (context.auth.uid !== uid) {
        return {
          success: false,
          error: 'Unauthorized - can only create binding for own UID'
        };
      }

      // ✅ Create/update userBinding using Admin SDK (bypasses Rules)
      const userBindingRef = db.collection('userBindings').doc(uid);
      await userBindingRef.set({
        uid,
        role,
        tenantId,
        userId: userId || uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log(`✅ [createUserBinding] Created userBinding for UID: ${uid}, role: ${role}`);

      return {
        success: true
      };
    } catch (error: any) {
      console.error('❌ [createUserBinding] Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create userBinding'
      };
    }
  }
);
