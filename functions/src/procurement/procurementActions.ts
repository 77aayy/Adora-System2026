/**
 * Cloud Functions: Procurement actions (approve, close)
 * Phase 4 - Server-side enforcement of tenant isolation
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function getUserTenantId(uid: string): Promise<string | null> {
  const snap = await db.collection('userBindings').doc(uid).get();
  const data = snap.data();
  return data?.tenantId ?? null;
}

async function assertUserCanAccessTenant(uid: string, tenantId: string): Promise<void> {
  const userTenantId = await getUserTenantId(uid);
  if (!userTenantId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'لم يتم ربط المستخدم بمؤسسة. يرجى تسجيل الدخول مرة أخرى.'
    );
  }
  if (userTenantId !== tenantId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'لا يمكن الوصول لبيانات مؤسسة أخرى'
    );
  }
}

/**
 * procurementApprove — Approve a procurement request
 */
export const procurementApprove = functions
  .region('us-central1')
  .https.onCall(
    async (data: {
      requestId: string;
      tenantId: string;
      managerId: string;
      managerName: string;
    }, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
      }
      await assertUserCanAccessTenant(context.auth.uid, data.tenantId);

      const { requestId, tenantId, managerId, managerName } = data;
      if (!requestId || !tenantId || !managerId || !managerName) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: requestId, tenantId, managerId, managerName'
        );
      }

      const requestRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('procurementRequests')
        .doc(requestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const requestData = requestSnap.data()!;
      const status = requestData.status;
      if (status !== 'PENDING_APPROVAL') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Request is not pending approval (current: ${status})`
        );
      }

      const now = admin.firestore.Timestamp.now();
      await requestRef.update({
        status: 'APPROVED',
        approvedAt: now,
        approvedBy: { id: managerId, name: managerName },
      });

      return { success: true };
    }
  );

/**
 * procurementClose — Close a procurement request (set status to COMPLETED)
 */
export const procurementClose = functions
  .region('us-central1')
  .https.onCall(
    async (data: { requestId: string; tenantId: string }, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
      }
      await assertUserCanAccessTenant(context.auth.uid, data.tenantId);

      const { requestId, tenantId } = data;
      if (!requestId || !tenantId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: requestId, tenantId'
        );
      }

      const requestRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('procurementRequests')
        .doc(requestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      await requestRef.update({ status: 'COMPLETED' });
      return { success: true };
    }
  );
