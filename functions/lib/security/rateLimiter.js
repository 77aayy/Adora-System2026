"use strict";
/**
 * Rate Limiting for Cloud Functions
 * Prevents brute force attacks and abuse
 * Adora Hotel Management System
 *
 * ⚠️ SETUP REQUIRED:
 * 1. cd functions
 * 2. npm install firebase-functions firebase-admin
 * 3. Deploy: firebase deploy --only functions
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
exports.resetUserRateLimit = exports.secureApiCall = exports.secureLogin = void 0;
exports.checkRateLimit = checkRateLimit;
exports.resetRateLimit = resetRateLimit;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// ============================================================
// RATE LIMIT CONFIGS
// ============================================================
const RATE_LIMITS = {
    login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 25, // 25 attempts per window (كان 5)
        blockDuration: 5 * 60 * 1000, // Block 5 minutes only (كان 15)
    },
    passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 3,
        blockDuration: 60 * 60 * 1000, // Block for 1 hour
    },
    apiCall: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60, // 60 requests per minute
        blockDuration: 5 * 60 * 1000, // Block for 5 minutes
    },
};
// ============================================================
// RATE LIMITER
// ============================================================
/**
 * Check if request is rate limited
 * Returns { allowed: boolean, remainingAttempts?: number }
 */
async function checkRateLimit(identifier, // IP address or user ID
action) {
    const config = RATE_LIMITS[action];
    if (!config) {
        throw new Error(`Unknown rate limit action: ${action}`);
    }
    const now = Date.now();
    const recordRef = db.collection('rateLimits').doc(`${action}_${identifier}`);
    try {
        const record = await recordRef.get();
        if (!record.exists) {
            // First request - create record
            await recordRef.set({
                count: 1,
                resetTime: now + config.windowMs,
            });
            return { allowed: true, remainingAttempts: config.maxRequests - 1 };
        }
        const data = record.data();
        // Check if blocked
        if (data.blockedUntil && data.blockedUntil > now) {
            return {
                allowed: false,
                blockedUntil: new Date(data.blockedUntil),
            };
        }
        // Check if window expired - reset
        if (data.resetTime < now) {
            await recordRef.set({
                count: 1,
                resetTime: now + config.windowMs,
            });
            return { allowed: true, remainingAttempts: config.maxRequests - 1 };
        }
        // Increment count
        const newCount = data.count + 1;
        // Check if exceeded limit
        if (newCount > config.maxRequests) {
            await recordRef.update({
                count: newCount,
                blockedUntil: now + config.blockDuration,
            });
            return {
                allowed: false,
                blockedUntil: new Date(now + config.blockDuration),
            };
        }
        // Within limit - increment
        await recordRef.update({ count: newCount });
        return {
            allowed: true,
            remainingAttempts: config.maxRequests - newCount,
        };
    }
    catch (error) {
        console.error('Rate limit check failed:', error);
        // On error, allow request (fail open)
        return { allowed: true };
    }
}
/**
 * Reset rate limit for a user (admin action)
 */
async function resetRateLimit(identifier, action) {
    const recordRef = db.collection('rateLimits').doc(`${action}_${identifier}`);
    await recordRef.delete();
}
// ============================================================
// CLOUD FUNCTIONS
// ============================================================
/**
 * Secure Login with Rate Limiting
 *
 * Usage from client:
 * ```typescript
 * const secureLogin = httpsCallable(functions, 'secureLogin');
 * const result = await secureLogin({ pin, branchId });
 * ```
 */
exports.secureLogin = functions.https.onCall(async (data, context) => {
    // Note: pin and branchId will be used when login logic is implemented
    // const { pin, branchId } = data;
    // Get client IP
    const ip = context.rawRequest.ip || 'unknown';
    // Check rate limit
    const rateLimitResult = await checkRateLimit(ip, 'login');
    if (!rateLimitResult.allowed) {
        const blockedUntil = rateLimitResult.blockedUntil;
        const minutesRemaining = blockedUntil
            ? Math.ceil((blockedUntil.getTime() - Date.now()) / 60000)
            : 15;
        throw new functions.https.HttpsError('resource-exhausted', `محاولات تسجيل دخول كثيرة. حاول مرة أخرى بعد ${minutesRemaining} دقيقة.`, { blockedUntil, remainingMinutes: minutesRemaining });
    }
    // Proceed with login (call existing userService logic)
    try {
        // Import your existing login logic
        // const user = await loginWithPin(pin, branchId);
        // For now, return placeholder
        // TODO: Implement actual login logic here
        return {
            success: true,
            message: 'Login successful',
            remainingAttempts: rateLimitResult.remainingAttempts,
        };
    }
    catch (error) {
        // Login failed - attempts still count
        throw new functions.https.HttpsError('unauthenticated', 'رمز PIN غير صحيح', { remainingAttempts: rateLimitResult.remainingAttempts });
    }
});
/**
 * Secure API endpoint with rate limiting
 *
 * Usage:
 * ```typescript
 * const api = httpsCallable(functions, 'secureApiCall');
 * const result = await api({ action: 'getData', params: {...} });
 * ```
 */
exports.secureApiCall = functions.https.onCall(async (data, context) => {
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً');
    }
    const userId = context.auth.uid;
    // Check rate limit
    const rateLimitResult = await checkRateLimit(userId, 'apiCall');
    if (!rateLimitResult.allowed) {
        throw new functions.https.HttpsError('resource-exhausted', 'طلبات كثيرة جداً. حاول مرة أخرى خلال دقائق.', { blockedUntil: rateLimitResult.blockedUntil });
    }
    // Process API call
    const { action } = data;
    // Handle different actions...
    switch (action) {
        case 'getData':
            // Return data
            return { success: true, data: [] };
        default:
            throw new functions.https.HttpsError('invalid-argument', 'Unknown action');
    }
});
/**
 * Admin function to reset rate limits
 * Only owner can call this
 */
exports.resetUserRateLimit = functions.https.onCall(async (data, context) => {
    var _a;
    // Security: Only owner
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
    const userDoc = await db.collection('userBindings').doc(context.auth.uid).get();
    if (!userDoc.exists || ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role) !== 'owner') {
        throw new functions.https.HttpsError('permission-denied', 'Owner access required');
    }
    const { identifier, action } = data;
    await resetRateLimit(identifier, action);
    return { success: true, message: 'Rate limit reset successfully' };
});
// ============================================================
// EXPORTS
// ============================================================
exports.default = {
    secureLogin: exports.secureLogin,
    secureApiCall: exports.secureApiCall,
    resetUserRateLimit: exports.resetUserRateLimit,
};
//# sourceMappingURL=rateLimiter.js.map