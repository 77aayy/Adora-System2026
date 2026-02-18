"use strict";
/**
 * ✅ Cloud Function: createUserBinding
 * Creates userBinding for owner using Admin SDK (bypasses client Rules)
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
exports.createUserBinding = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * ✅ Create userBinding via Cloud Function (Admin SDK - bypasses client Rules)
 * ✅ CORS enabled for localhost development
 */
exports.createUserBinding = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
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
    }
    catch (error) {
        console.error('❌ [createUserBinding] Error:', error);
        return {
            success: false,
            error: error.message || 'Failed to create userBinding'
        };
    }
});
//# sourceMappingURL=userBinding.js.map