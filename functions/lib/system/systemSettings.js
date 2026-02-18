"use strict";
/**
 * ✅ Cloud Function: getSystemSettings
 * Handles system settings retrieval with Admin SDK
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
exports.setSystemSettings = exports.getSystemSettings = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * ✅ Get System Settings via Cloud Function
 * Uses Admin SDK - no Rules needed
 * ✅ CORS enabled for localhost development
 */
exports.getSystemSettings = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    try {
        // ✅ Require authentication (any authenticated user can read)
        if (!context.auth) {
            return {
                success: false,
                error: 'Authentication required'
            };
        }
        const settingsDoc = await db.collection('system').doc('settings').get();
        if (!settingsDoc.exists) {
            // Return default settings
            return {
                success: true,
                settings: {
                    defaultSubscriptionPrice: 1000,
                    developerBranding: null
                }
            };
        }
        const settingsData = settingsDoc.data();
        return {
            success: true,
            settings: settingsData
        };
    }
    catch (error) {
        console.error('getSystemSettings error:', error);
        return {
            success: false,
            error: error.message || 'Failed to load system settings'
        };
    }
});
/**
 * ✅ Set System Settings (Owner only)
 * ✅ CORS enabled for localhost development
 */
exports.setSystemSettings = functions
    .region('us-central1')
    .https.onCall(async (data, context) => {
    var _a, _b;
    try {
        // ✅ Require authentication
        if (!context.auth) {
            return {
                success: false,
                error: 'Authentication required'
            };
        }
        // ✅ Check if user is owner (from custom claims or userBindings)
        const userBindingsDoc = await db.collection('userBindings').doc(context.auth.uid).get();
        let isOwner = false;
        if (userBindingsDoc.exists) {
            const bindingData = userBindingsDoc.data();
            isOwner = bindingData.role === 'owner';
        }
        // Also check custom claims
        if (!isOwner) {
            try {
                const userRecord = await admin.auth().getUser(context.auth.uid);
                isOwner = ((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.role) === 'owner' ||
                    ((_b = userRecord.customClaims) === null || _b === void 0 ? void 0 : _b.super_admin) === true;
            }
            catch (e) {
                // Ignore
            }
        }
        if (!isOwner) {
            return {
                success: false,
                error: 'Unauthorized: Owner access required'
            };
        }
        // ✅ Update settings
        await db.collection('system').doc('settings').set(data.settings, { merge: true });
        return {
            success: true,
            settings: data.settings
        };
    }
    catch (error) {
        console.error('setSystemSettings error:', error);
        return {
            success: false,
            error: error.message || 'Failed to update system settings'
        };
    }
});
//# sourceMappingURL=systemSettings.js.map