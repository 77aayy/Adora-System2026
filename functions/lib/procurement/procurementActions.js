"use strict";
/**
 * Cloud Functions: Procurement actions (approve, close)
 * Phase 4 - Server-side enforcement of tenant isolation
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
exports.procurementClose = exports.procurementApprove = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
async function getUserTenantId(uid) {
    var _a;
    const snap = await db.collection('userBindings').doc(uid).get();
    const data = snap.data();
    return (_a = data === null || data === void 0 ? void 0 : data.tenantId) !== null && _a !== void 0 ? _a : null;
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
 * procurementApprove — Approve a procurement request
 */
exports.procurementApprove = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }
    await assertUserCanAccessTenant(context.auth.uid, data.tenantId);
    const { requestId, tenantId, managerId, managerName } = data;
    if (!requestId || !tenantId || !managerId || !managerName) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: requestId, tenantId, managerId, managerName');
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
    const requestData = requestSnap.data();
    const status = requestData.status;
    if (status !== 'PENDING_APPROVAL') {
        throw new functions.https.HttpsError('failed-precondition', `Request is not pending approval (current: ${status})`);
    }
    const now = admin.firestore.Timestamp.now();
    await requestRef.update({
        status: 'APPROVED',
        approvedAt: now,
        approvedBy: { id: managerId, name: managerName },
    });
    return { success: true };
});
/**
 * procurementClose — Close a procurement request (set status to COMPLETED)
 */
exports.procurementClose = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }
    await assertUserCanAccessTenant(context.auth.uid, data.tenantId);
    const { requestId, tenantId } = data;
    if (!requestId || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields: requestId, tenantId');
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
});
//# sourceMappingURL=procurementActions.js.map