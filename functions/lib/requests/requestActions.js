"use strict";
/**
 * Cloud Functions: Request actions (confirm completion, complete, transfer)
 * Phase 2 - Server-side enforcement of tenant isolation
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
exports.requestTransferToDepartment = exports.requestComplete = exports.requestConfirmCompletion = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
async function logRequestAudit(action, requestId, tenantId, userId, userName, department) {
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
    }
    catch (e) {
        console.warn('audit_log write failed', e);
    }
}
async function getUserTenantId(uid) {
    var _a;
    const snap = await db.collection('userBindings').doc(uid).get();
    const data = snap.data();
    return (_a = data === null || data === void 0 ? void 0 : data.tenantId) !== null && _a !== void 0 ? _a : null;
}
function assertAuthAndTenant(context, tenantId) {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }
    // TenantId is validated by caller; server will verify request belongs to user's tenant
}
async function assertUserCanAccessTenant(uid, tenantId) {
    const userTenantId = await getUserTenantId(uid);
    if (!userTenantId) {
        throw new functions.https.HttpsError('permission-denied', 'لم يتم ربط المستخدم بمؤسسة. يرجى تسجيل الدخول مرة أخرى.');
    }
    if (userTenantId !== tenantId) {
        throw new functions.https.HttpsError('permission-denied', 'لا يمكن الوصول لبيانات مؤسسة أخرى');
    }
}
/**
 * requestConfirmCompletion — Confirm completion and close request
 */
exports.requestConfirmCompletion = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    assertAuthAndTenant(context, data.tenantId);
    await assertUserCanAccessTenant(context.auth.uid, data.tenantId);
    const { requestId, tenantId, userId, userName, department } = data;
    if (!requestId || !tenantId || !userId || !userName || !department) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: requestId, tenantId, userId, userName, department');
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
    const request = requestSnap.data();
    const currentStatus = (request.status || '').toString().toUpperCase();
    // Idempotency: already completed — return success without updating
    if (currentStatus === 'COMPLETED') {
        return { success: true };
    }
    // Do not overwrite CANCELLED with COMPLETED (operational truth)
    if (currentStatus === 'CANCELLED') {
        throw new functions.https.HttpsError('failed-precondition', 'Cannot confirm completion for a cancelled request');
    }
    // Only allow confirm-completion from states that represent work done or in handoff
    const allowedForConfirmCompletion = [
        'IN_PROGRESS', 'IN PROGRESS', 'CONFIRMED', 'NEW',
        'PENDING_RECEPTION', 'PENDING_HOUSEKEEPING', 'PENDING_MAINTENANCE', 'WAITING_PARTS'
    ];
    if (!allowedForConfirmCompletion.includes(currentStatus)) {
        throw new functions.https.HttpsError('failed-precondition', `Cannot confirm completion from status: ${currentStatus}`);
    }
    const now = admin.firestore.Timestamp.now();
    const history = (request.departmentHistory || []);
    const historyCopy = history.map((entry) => (Object.assign({}, entry)));
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
});
/**
 * requestComplete — Mark request as completed (core fields only; points/sentiment stay client)
 */
exports.requestComplete = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    assertAuthAndTenant(context, data.tenantId);
    await assertUserCanAccessTenant(context.auth.uid, data.tenantId);
    const { requestId, tenantId, userId, userName, rating, feedback, sentimentResult } = data;
    if (!requestId || !tenantId || !userId || !userName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: requestId, tenantId, userId, userName');
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
    const requestData = requestSnap.data();
    const currentStatus = (requestData.status || '').toString().toUpperCase();
    // Idempotency: already completed — return success without updating
    if (currentStatus === 'COMPLETED') {
        return { success: true };
    }
    // Only allow completion from IN_PROGRESS (or legacy equivalent)
    const allowedBefore = ['IN_PROGRESS', 'IN PROGRESS', 'CONFIRMED'];
    if (!allowedBefore.includes(currentStatus)) {
        throw new functions.https.HttpsError('failed-precondition', `Request cannot be completed from status: ${currentStatus}`);
    }
    const now = admin.firestore.Timestamp.now();
    const update = {
        status: 'COMPLETED',
        currentDepartment: 'reception',
        isActionRequiredByReception: true,
        completedBy: { id: userId, name: userName },
        completedAt: now,
        'timeline.completed': now,
    };
    if (rating !== undefined)
        update.rating = rating;
    if (feedback !== undefined)
        update.feedback = feedback;
    if (sentimentResult !== undefined)
        update.sentimentResult = sentimentResult;
    await requestRef.update(update);
    await logRequestAudit('REQUEST_COMPLETE', requestId, tenantId, userId, userName, 'reception');
    return { success: true };
});
/**
 * requestTransferToDepartment — Transfer request to another department
 */
exports.requestTransferToDepartment = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    var _a;
    assertAuthAndTenant(context, data.tenantId);
    await assertUserCanAccessTenant(context.auth.uid, data.tenantId);
    const { requestId, tenantId, targetDepartment, userId, userName, fromDepartment, status, notes, } = data;
    if (!requestId || !tenantId || !targetDepartment || !userId || !userName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: requestId, tenantId, targetDepartment, userId, userName');
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
    const request = requestSnap.data();
    const history = (request.departmentHistory || []);
    const now = admin.firestore.Timestamp.now();
    const fromDept = (_a = fromDepartment !== null && fromDepartment !== void 0 ? fromDepartment : request.currentDepartment) !== null && _a !== void 0 ? _a : 'reception';
    if (history.length > 0) {
        const lastEntry = history[history.length - 1];
        if (lastEntry.department === fromDept && !lastEntry.exitedAt) {
            lastEntry.exitedAt = now;
            lastEntry.nextDepartment = targetDepartment;
            if (notes)
                lastEntry.notes = notes;
        }
    }
    history.push({
        department: targetDepartment,
        status: status || 'NEW',
        enteredAt: now,
        handledBy: { id: userId, name: userName },
        notes: notes !== null && notes !== void 0 ? notes : undefined,
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
});
//# sourceMappingURL=requestActions.js.map