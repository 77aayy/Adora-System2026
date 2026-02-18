/**
 * Cloud Functions: Request actions (confirm completion, complete, transfer)
 * Phase 2 - Server-side enforcement of tenant isolation
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function logRequestAudit(
  action: 'REQUEST_CONFIRM_COMPLETION' | 'REQUEST_COMPLETE',
  requestId: string,
  tenantId: string,
  userId: string,
  userName: string,
  department: string
): Promise<void> {
  try {
    await db.collection('audit_logs').add({
      action,
      requestId,
      tenantId,
      userId,
      userName,
      department,
      source: 'callable',
      timestamp: admin.firestore.Timestamp.now(),
    });
  } catch (e) {
    console.warn('audit_log write failed', e);
  }
}

async function getUserTenantId(uid: string): Promise<string | null> {
  const snap = await db.collection('userBindings').doc(uid).get();
  const data = snap.data();
  return data?.tenantId ?? null;
}

function assertAuthAndTenant(
  context: functions.https.CallableContext,
  tenantId: string
): void {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
  }
  // TenantId is validated by caller; server will verify request belongs to user's tenant
}

async function assertUserCanAccessTenant(
  uid: string,
  tenantId: string
): Promise<void> {
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
 * requestConfirmCompletion — Confirm completion and close request
 */
export const requestConfirmCompletion = functions
  .region('us-central1')
  .https.onCall(
    async (data: {
      requestId: string;
      tenantId: string;
      userId: string;
      userName: string;
      department: string;
    }, context) => {
      assertAuthAndTenant(context!, data.tenantId);
      await assertUserCanAccessTenant(context!.auth!.uid, data.tenantId);

      const { requestId, tenantId, userId, userName, department } = data;
      if (!requestId || !tenantId || !userId || !userName || !department) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: requestId, tenantId, userId, userName, department'
        );
      }

      const requestRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('requests')
        .doc(requestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const request = requestSnap.data()!;
      const currentStatus = (request.status || '').toString().toUpperCase();
      // Idempotency: already completed — return success without updating
      if (currentStatus === 'COMPLETED') {
        return { success: true };
      }
      // Do not overwrite CANCELLED with COMPLETED (operational truth)
      if (currentStatus === 'CANCELLED') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Cannot confirm completion for a cancelled request'
        );
      }
      // Only allow confirm-completion from states that represent work done or in handoff
      const allowedForConfirmCompletion = [
        'IN_PROGRESS', 'IN PROGRESS', 'CONFIRMED', 'NEW',
        'PENDING_RECEPTION', 'PENDING_HOUSEKEEPING', 'PENDING_MAINTENANCE', 'WAITING_PARTS'
      ];
      if (!allowedForConfirmCompletion.includes(currentStatus)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Cannot confirm completion from status: ${currentStatus}`
        );
      }

      const now = admin.firestore.Timestamp.now();
      const history = (request.departmentHistory || []) as Array<{
        department: string;
        exitedAt?: admin.firestore.Timestamp;
        status?: string;
      }>;
      const historyCopy = history.map((entry: any) => ({ ...entry }));
      if (historyCopy.length > 0) {
        const lastEntry = historyCopy[historyCopy.length - 1];
        if (lastEntry.department === department) {
          lastEntry.exitedAt = now;
          lastEntry.status = 'COMPLETED';
        }
      }

      await requestRef.update({
        status: 'COMPLETED',
        completedAt: now,
        'timeline.completed': now,
        departmentHistory: historyCopy,
        currentDepartment: admin.firestore.FieldValue.delete(),
        modifiedAt: now,
        modifiedBy: {
          id: userId,
          name: userName,
          department,
        },
      });

      await logRequestAudit('REQUEST_CONFIRM_COMPLETION', requestId, tenantId, userId, userName, department);
      return { success: true };
    }
  );

/**
 * requestComplete — Mark request as completed (core fields only; points/sentiment stay client)
 */
export const requestComplete = functions
  .region('us-central1')
  .https.onCall(
    async (data: {
      requestId: string;
      tenantId: string;
      userId: string;
      userName: string;
      rating?: number;
      feedback?: string;
      sentimentResult?: Record<string, unknown>;
    }, context) => {
      assertAuthAndTenant(context!, data.tenantId);
      await assertUserCanAccessTenant(context!.auth!.uid, data.tenantId);

      const { requestId, tenantId, userId, userName, rating, feedback, sentimentResult } = data;
      if (!requestId || !tenantId || !userId || !userName) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: requestId, tenantId, userId, userName'
        );
      }

      const requestRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('requests')
        .doc(requestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const requestData = requestSnap.data()! as { status?: string };
      const currentStatus = (requestData.status || '').toString().toUpperCase();
      // Idempotency: already completed — return success without updating
      if (currentStatus === 'COMPLETED') {
        return { success: true };
      }
      // Only allow completion from IN_PROGRESS (or legacy equivalent)
      const allowedBefore = ['IN_PROGRESS', 'IN PROGRESS', 'CONFIRMED'];
      if (!allowedBefore.includes(currentStatus)) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Request cannot be completed from status: ${currentStatus}`
        );
      }

      const now = admin.firestore.Timestamp.now();
      const update: Record<string, unknown> = {
        status: 'COMPLETED',
        currentDepartment: 'reception',
        isActionRequiredByReception: true,
        completedBy: { id: userId, name: userName },
        completedAt: now,
        'timeline.completed': now,
      };
      if (rating !== undefined) update.rating = rating;
      if (feedback !== undefined) update.feedback = feedback;
      if (sentimentResult !== undefined) update.sentimentResult = sentimentResult;

      await requestRef.update(update);
      await logRequestAudit('REQUEST_COMPLETE', requestId, tenantId, userId, userName, 'reception');
      return { success: true };
    }
  );

/**
 * requestTransferToDepartment — Transfer request to another department
 */
export const requestTransferToDepartment = functions
  .region('us-central1')
  .https.onCall(
    async (data: {
      requestId: string;
      tenantId: string;
      targetDepartment: string;
      userId: string;
      userName: string;
      fromDepartment?: string;
      status?: string;
      notes?: string;
    }, context) => {
      assertAuthAndTenant(context!, data.tenantId);
      await assertUserCanAccessTenant(context!.auth!.uid, data.tenantId);

      const {
        requestId,
        tenantId,
        targetDepartment,
        userId,
        userName,
        fromDepartment,
        status,
        notes,
      } = data;
      if (!requestId || !tenantId || !targetDepartment || !userId || !userName) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Missing required fields: requestId, tenantId, targetDepartment, userId, userName'
        );
      }

      const requestRef = db
        .collection('tenants')
        .doc(tenantId)
        .collection('requests')
        .doc(requestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Request not found');
      }

      const request = requestSnap.data()!;
      const history = (request.departmentHistory || []) as Array<{
        department: string;
        exitedAt?: admin.firestore.Timestamp;
        nextDepartment?: string;
        notes?: string;
        enteredAt: admin.firestore.Timestamp;
        status?: string;
        handledBy?: { id: string; name: string };
      }>;
      const now = admin.firestore.Timestamp.now();
      const fromDept = fromDepartment ?? request.currentDepartment ?? 'reception';

      if (history.length > 0) {
        const lastEntry = history[history.length - 1];
        if (lastEntry.department === fromDept && !lastEntry.exitedAt) {
          lastEntry.exitedAt = now;
          lastEntry.nextDepartment = targetDepartment;
          if (notes) lastEntry.notes = notes;
        }
      }

      history.push({
        department: targetDepartment,
        status: status || 'NEW',
        enteredAt: now,
        handledBy: { id: userId, name: userName },
        notes: notes ?? undefined,
      });

      await requestRef.update({
        currentDepartment: targetDepartment,
        status: status || 'NEW',
        deliveredAt: now,
        departmentHistory: history,
        modifiedAt: now,
        modifiedBy: { id: userId, name: userName },
      });

      return { success: true };
    }
  );
