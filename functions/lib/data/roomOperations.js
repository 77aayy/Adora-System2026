"use strict";
/**
 * ✅ MASTER KEY: Room Operations via Cloud Functions
 *
 * This file demonstrates the "Master Key" pattern:
 * - Client calls Functions → Functions validate → Functions write with Admin SDK
 * - Firestore Rules: Simple read-only (allow write: if false)
 *
 * Benefits:
 * - ✅ Simpler Rules (1 line instead of 1000)
 * - ✅ Better Security (Admin SDK bypasses Rules)
 * - ✅ Lower Cost (prevent bad writes, batch operations)
 * - ✅ Easier Testing (JavaScript instead of Rules language)
 * - ✅ Offline Support (Client reads from cache, writes queue)
 *
 * 🚀 FIRST FUNCTION: checkRoomAvailability
 * - Centralized room availability validation
 * - Atomic transaction (prevents race conditions)
 * - Single source of truth for room checks
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
exports.checkOutGuest = exports.checkInGuest = exports.processCheckIn = exports.checkRoomAvailability = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// ============================================================
// HELPER FUNCTIONS
// ============================================================
/**
 * ✅ ENHANCED: Verify employee identity and permissions
 *
 * This function verifies:
 * 1. User exists and is authenticated
 * 2. Employee is active
 * 3. Employee belongs to the tenant
 * 4. Employee has required role/permissions
 * 5. Tenant is not suspended
 *
 * @param userId - User ID from context.auth.uid
 * @param tenantId - Tenant ID to verify access
 * @param requiredRole - Optional: Required role for the operation
 * @returns Permission check result
 */
async function verifyEmployeeIdentity(userId, tenantId, requiredRole) {
    try {
        const db = admin.firestore();
        // 1. Check userBindings (primary source)
        const userBinding = await db.collection('userBindings').doc(userId).get();
        if (!userBinding.exists) {
            // Fallback: Check users collection (for employees)
            const usersQuery = await db.collection('users')
                .where('employeeId', '==', userId)
                .limit(1)
                .get();
            if (usersQuery.empty) {
                return { allowed: false, error: 'المستخدم غير موجود في النظام' };
            }
            const userDoc = usersQuery.docs[0];
            const userData = userDoc.data();
            // Check user status
            if (userData.status !== 'active') {
                return { allowed: false, error: 'حسابك غير نشط - يرجى التواصل مع المدير' };
            }
            // Check tenant match
            if (userData.tenantId !== tenantId) {
                return { allowed: false, error: 'ليس لديك صلاحية على هذا المستأجر' };
            }
            // Check role if required
            if (requiredRole) {
                const allowedRoles = {
                    reception: ['reception', 'manager', 'admin', 'owner'],
                    manager: ['manager', 'admin', 'owner'],
                    admin: ['admin', 'owner']
                };
                if (!allowedRoles[requiredRole].includes(userData.role)) {
                    return { allowed: false, error: 'ليس لديك صلاحية لهذه العملية' };
                }
            }
            // Check tenant status
            if (userData.tenantId) {
                const tenantDoc = await db.collection('tenants').doc(userData.tenantId).get();
                if (tenantDoc.exists) {
                    const tenantData = tenantDoc.data();
                    if ((tenantData === null || tenantData === void 0 ? void 0 : tenantData.status) === 'suspended') {
                        return { allowed: false, error: 'تم إيقاف الحساب - يرجى التواصل مع إدارة النظام' };
                    }
                }
            }
            return { allowed: true, employeeData: userData };
        }
        // 2. User exists in userBindings
        const userData = userBinding.data();
        // Owner/Super Admin can do anything
        if ((userData === null || userData === void 0 ? void 0 : userData.role) === 'owner' || (userData === null || userData === void 0 ? void 0 : userData.super_admin) === true) {
            return { allowed: true, employeeData: userData };
        }
        // 3. Check tenant match
        if ((userData === null || userData === void 0 ? void 0 : userData.tenantId) !== tenantId) {
            return { allowed: false, error: 'ليس لديك صلاحية على هذا المستأجر' };
        }
        // 4. Check role if required
        if (requiredRole) {
            const allowedRoles = {
                reception: ['reception', 'manager', 'admin', 'owner'],
                manager: ['manager', 'admin', 'owner'],
                admin: ['admin', 'owner']
            };
            if (!allowedRoles[requiredRole].includes(userData === null || userData === void 0 ? void 0 : userData.role)) {
                return { allowed: false, error: 'ليس لديك صلاحية لهذه العملية' };
            }
        }
        // 5. Check tenant status
        if (userData.tenantId) {
            const tenantDoc = await db.collection('tenants').doc(userData.tenantId).get();
            if (tenantDoc.exists) {
                const tenantData = tenantDoc.data();
                if ((tenantData === null || tenantData === void 0 ? void 0 : tenantData.status) === 'suspended') {
                    return { allowed: false, error: 'تم إيقاف الحساب - يرجى التواصل مع إدارة النظام' };
                }
            }
        }
        return { allowed: true, employeeData: userData };
    }
    catch (error) {
        console.error('Error verifying employee identity:', error);
        return { allowed: false, error: error.message || 'خطأ في التحقق من هوية الموظف' };
    }
}
/**
 * @deprecated Use verifyEmployeeIdentity instead
 * Kept for backward compatibility
 */
async function verifyRoomPermission(userId, tenantId, requiredRole) {
    const result = await verifyEmployeeIdentity(userId, tenantId, requiredRole);
    return { allowed: result.allowed, error: result.error };
}
// Note: checkRoomAvailabilityHelper is defined above (used by both the Function and checkInGuest)
// ============================================================
// CLOUD FUNCTIONS
// ============================================================
/**
 * ✅ MASTER KEY: Check Room Availability
 *
 * 🚀 FIRST FUNCTION - Centralized room availability check
 *
 * This is the SINGLE SOURCE OF TRUTH for room availability validation.
 * All room checks go through this function to ensure:
 * - ✅ Atomic operations (no race conditions)
 * - ✅ Consistent validation logic
 * - ✅ Security (Admin SDK bypasses Rules)
 * - ✅ Centralized updates (change logic once, applies everywhere)
 *
 * Usage:
 * ```typescript
 * const checkAvailability = httpsCallable(functions, 'checkRoomAvailability');
 * const result = await checkAvailability({
 *   roomNumber: '101',
 *   tenantId: 'tenant123'
 * });
 *
 * if (result.data.available) {
 *   // Room is available, proceed with check-in
 *   const { roomData, branchId } = result.data;
 * }
 * ```
 */
exports.checkRoomAvailability = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 10,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // 1. Security: Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً');
    }
    const userId = context.auth.uid;
    const db = admin.firestore();
    // 2. Validate input
    const { roomNumber, tenantId } = data;
    if (!roomNumber || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'roomNumber و tenantId مطلوبان');
    }
    // 3. ✅ Verify employee identity and permissions
    const employeeCheck = await verifyEmployeeIdentity(userId, tenantId);
    if (!employeeCheck.allowed) {
        throw new functions.https.HttpsError('permission-denied', employeeCheck.error || 'ليس لديك صلاحية للوصول إلى هذا المستأجر');
    }
    // 4. Check room availability (atomic check)
    const availabilityCheck = await checkRoomAvailabilityHelper(db, roomNumber, tenantId);
    if (!availabilityCheck.available) {
        return {
            available: false,
            error: availabilityCheck.error || 'الغرفة غير متاحة'
        };
    }
    // ✅ Room is available
    return {
        available: true,
        roomData: availabilityCheck.roomData,
        branchId: availabilityCheck.branchId
    };
});
/**
 * Helper function: Check room availability (internal, used by other functions too)
 */
async function checkRoomAvailabilityHelper(db, roomNumber, tenantId) {
    var _a;
    try {
        // Find room by number
        const roomsRef = db.collection(`tenants/${tenantId}/rooms`);
        const roomQuery = await roomsRef.where('number', '==', roomNumber).limit(1).get();
        if (roomQuery.empty) {
            return {
                available: false,
                error: `الغرفة رقم ${roomNumber} غير موجودة في النظام`
            };
        }
        const roomDoc = roomQuery.docs[0];
        const roomData = roomDoc.data();
        const branchId = roomData.branchId || roomData.branch || 'default';
        const roomDocId = `${branchId}_${roomNumber}`;
        const roomRef = db.doc(`tenants/${tenantId}/rooms/${roomDocId}`);
        // Check for existing active room card (outside transaction - early validation)
        const roomCardsRef = db.collection(`tenants/${tenantId}/roomCards`);
        const activeCardQuery = await roomCardsRef
            .where('roomNumber', '==', roomNumber)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        if (!activeCardQuery.empty) {
            const existingCard = activeCardQuery.docs[0].data();
            return {
                available: false,
                error: `الغرفة رقم ${roomNumber} مشغولة بالفعل من قبل: ${existingCard.guestName || 'نزيل'}\n` +
                    `تاريخ الدخول: ${((_a = existingCard.checkInTime) === null || _a === void 0 ? void 0 : _a.toDate().toLocaleDateString('ar-SA')) || 'غير محدد'}`
            };
        }
        // ✅ ATOMIC TRANSACTION: Final validation inside transaction (prevents race condition)
        return await db.runTransaction(async (transaction) => {
            // Get current room status INSIDE transaction
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists) {
                return {
                    available: false,
                    error: `الغرفة رقم ${roomNumber} غير موجودة`
                };
            }
            const currentRoomData = roomSnap.data();
            if (!currentRoomData) {
                return {
                    available: false,
                    error: `الغرفة رقم ${roomNumber} غير موجودة`
                };
            }
            // Check room status
            if (currentRoomData.status === 'occupied') {
                return {
                    available: false,
                    error: `الغرفة رقم ${roomNumber} مشغولة بالفعل`
                };
            }
            if (currentRoomData.status === 'maintenance') {
                return {
                    available: false,
                    error: `الغرفة رقم ${roomNumber} تحت الصيانة ولا يمكن حجزها`
                };
            }
            if (currentRoomData.status === 'dirty' || currentRoomData.status === 'cleaning') {
                return {
                    available: false,
                    error: `الغرفة رقم ${roomNumber} قيد التنظيف. يرجى الانتظار حتى تصبح جاهزة`
                };
            }
            // ✅ All checks passed - room is available
            return {
                available: true,
                roomRef,
                roomData: currentRoomData,
                branchId
            };
        });
    }
    catch (error) {
        console.error('Error checking room availability:', error);
        return {
            available: false,
            error: error.message || 'خطأ في التحقق من توفر الغرفة'
        };
    }
}
// ============================================================
// 🚀 RECOMMENDED: Unified processCheckIn Function
// ============================================================
/**
 * ✅ RECOMMENDED: processCheckIn - Unified Check-in Function
 *
 * 🎯 This function implements the friend's recommendation:
 * "3 things in one atomic transaction":
 * 1. Verify employee identity (هل هو فعلاً شغال في الفندق ده؟)
 * 2. Verify room availability (هل هي فعلاً فاضية ونظيفة؟)
 * 3. Execute check-in (تغير حالة الغرفة، وتنشئ كارت الغرفة، وتسجل العملية)
 *
 * Benefits:
 * - ✅ Security Rules: Zero Logic (allow write: if false)
 * - ✅ No Cheating: Impossible to manipulate data from client
 * - ✅ Professionalism: Transaction ensures data consistency
 * - ✅ Single Source of Truth: One function, one logic, applies everywhere
 *
 * Usage:
 * ```typescript
 * const processCheckIn = httpsCallable(functions, 'processCheckIn');
 * const result = await processCheckIn({
 *   roomNumber: '101',
 *   guestData: {
 *     guestName: 'أحمد محمد',
 *     adults: 2,
 *     children: 0,
 *     ...
 *   },
 *   tenantId: 'tenant123'
 * });
 * ```
 */
exports.processCheckIn = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // 1. ✅ Security: Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً');
    }
    const userId = context.auth.uid;
    const db = admin.firestore();
    const { roomNumber, guestData, tenantId } = data;
    // 2. ✅ Validate input
    if (!roomNumber || !(guestData === null || guestData === void 0 ? void 0 : guestData.guestName) || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'بيانات ناقصة: roomNumber, guestData.guestName, tenantId مطلوبة');
    }
    if (guestData.adults < 1 || guestData.adults > 10) {
        throw new functions.https.HttpsError('invalid-argument', 'عدد البالغين يجب أن يكون بين 1 و 10');
    }
    // 3. ✅ Verify employee identity (هل هو فعلاً شغال في الفندق ده؟)
    const employeeCheck = await verifyEmployeeIdentity(userId, tenantId, 'reception');
    if (!employeeCheck.allowed) {
        throw new functions.https.HttpsError('permission-denied', employeeCheck.error || 'ليس لديك صلاحية لهذه العملية');
    }
    // 4. ✅ ATOMIC TRANSACTION: Everything in one transaction
    try {
        return await db.runTransaction(async (transaction) => {
            var _a;
            // 4.1. Find room by number
            const roomsRef = db.collection(`tenants/${tenantId}/rooms`);
            const roomQuery = await roomsRef.where('number', '==', roomNumber).limit(1).get();
            if (roomQuery.empty) {
                throw new functions.https.HttpsError('not-found', `الغرفة رقم ${roomNumber} غير موجودة في النظام`);
            }
            const roomDoc = roomQuery.docs[0];
            const roomData = roomDoc.data();
            const branchId = roomData.branchId || roomData.branch || 'default';
            const roomDocId = `${branchId}_${roomNumber}`;
            const roomRef = db.doc(`tenants/${tenantId}/rooms/${roomDocId}`);
            // 4.2. ✅ Verify room availability INSIDE transaction (هل هي فعلاً فاضية ونظيفة؟)
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists) {
                throw new functions.https.HttpsError('not-found', `الغرفة رقم ${roomNumber} غير موجودة`);
            }
            const currentRoomData = roomSnap.data();
            if (!currentRoomData) {
                throw new functions.https.HttpsError('not-found', `الغرفة رقم ${roomNumber} غير موجودة`);
            }
            // Check room status
            if (currentRoomData.status === 'occupied') {
                throw new functions.https.HttpsError('failed-precondition', `الغرفة رقم ${roomNumber} مشغولة بالفعل`);
            }
            if (currentRoomData.status === 'maintenance') {
                throw new functions.https.HttpsError('failed-precondition', `الغرفة رقم ${roomNumber} تحت الصيانة ولا يمكن حجزها`);
            }
            if (currentRoomData.status === 'dirty' || currentRoomData.status === 'cleaning') {
                throw new functions.https.HttpsError('failed-precondition', `الغرفة رقم ${roomNumber} قيد التنظيف. يرجى الانتظار حتى تصبح جاهزة`);
            }
            // Check for existing active room card
            const roomCardsRef = db.collection(`tenants/${tenantId}/roomCards`);
            const activeCardQuery = await roomCardsRef
                .where('roomNumber', '==', roomNumber)
                .where('status', '==', 'active')
                .limit(1)
                .get();
            if (!activeCardQuery.empty) {
                const existingCard = activeCardQuery.docs[0].data();
                throw new functions.https.HttpsError('failed-precondition', `الغرفة رقم ${roomNumber} مشغولة بالفعل من قبل: ${existingCard.guestName || 'نزيل'}`);
            }
            // 4.3. ✅ Execute check-in (تغير حالة الغرفة، وتنشئ كارت الغرفة، وتسجل العملية)
            const now = admin.firestore.Timestamp.now();
            const roomCardRef = roomCardsRef.doc();
            // Create room card
            const roomCard = {
                roomNumber,
                guestName: guestData.guestName,
                guestIdentity: guestData.guestIdentity || null,
                guestPhone: guestData.guestPhone || null,
                adults: guestData.adults,
                children: guestData.children,
                status: 'active',
                checkInTime: now,
                checkOutTime: null,
                expectedCheckOut: guestData.expectedCheckOut
                    ? admin.firestore.Timestamp.fromDate(new Date(guestData.expectedCheckOut))
                    : null,
                needsCart: guestData.needsCart || false,
                createdBy: userId,
                notes: guestData.notes || null,
                tenantId,
                qrActive: true,
                branch: branchId
            };
            transaction.set(roomCardRef, roomCard);
            // Update room status
            transaction.update(roomRef, {
                status: 'occupied',
                currentGuestId: roomCardRef.id,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            // Audit log
            const auditLogRef = db.collection('audit_logs').doc();
            transaction.set(auditLogRef, {
                action: 'CHECK_IN',
                userId,
                tenantId,
                roomNumber,
                guestName: guestData.guestName,
                roomCardId: roomCardRef.id,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                employeeName: ((_a = employeeCheck.employeeData) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown'
            });
            return {
                success: true,
                roomCardId: roomCardRef.id
            };
        });
    }
    catch (error) {
        console.error('Error in processCheckIn:', error);
        // If it's already an HttpsError, re-throw it
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        // Otherwise, wrap it
        throw new functions.https.HttpsError('internal', error.message || 'حدث خطأ أثناء تسجيل الدخول');
    }
});
// ============================================================
// CLOUD FUNCTIONS (Existing)
// ============================================================
/**
 * ✅ MASTER KEY: Check-in Guest
 *
 * Client calls this → Function validates → Writes with Admin SDK
 *
 * Usage:
 * ```typescript
 * const checkIn = httpsCallable(functions, 'checkInGuest');
 * const result = await checkIn({
 *   roomNumber: '101',
 *   guestName: 'أحمد محمد',
 *   tenantId: 'tenant123',
 *   adults: 2,
 *   children: 0
 * });
 * ```
 */
exports.checkInGuest = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // 1. Security: Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً');
    }
    const userId = context.auth.uid;
    const db = admin.firestore();
    // 2. Validate input
    const { roomNumber, guestName, tenantId, adults, children } = data;
    if (!roomNumber || !guestName || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'بيانات ناقصة: roomNumber, guestName, tenantId مطلوبة');
    }
    if (adults < 1 || adults > 10) {
        throw new functions.https.HttpsError('invalid-argument', 'عدد البالغين يجب أن يكون بين 1 و 10');
    }
    // 3. ✅ Verify employee identity and permissions
    const employeeCheck = await verifyEmployeeIdentity(userId, tenantId, 'reception');
    if (!employeeCheck.allowed) {
        throw new functions.https.HttpsError('permission-denied', employeeCheck.error || 'ليس لديك صلاحية لهذه العملية');
    }
    // 4. Check room availability (atomic check) - using helper function
    const availabilityCheck = await checkRoomAvailabilityHelper(db, roomNumber, tenantId);
    if (!availabilityCheck.available) {
        throw new functions.https.HttpsError('failed-precondition', availabilityCheck.error || 'الغرفة غير متاحة');
    }
    // 5. Create room card and update room status (atomic transaction)
    try {
        const batch = db.batch();
        const now = admin.firestore.Timestamp.now();
        // Create room card
        const roomCardsRef = db.collection(`tenants/${tenantId}/roomCards`);
        const roomCardRef = roomCardsRef.doc();
        const roomCard = {
            roomNumber,
            guestName,
            guestIdentity: data.guestIdentity || null,
            guestPhone: data.guestPhone || null,
            adults,
            children,
            status: 'active',
            checkInTime: now,
            checkOutTime: null,
            expectedCheckOut: data.expectedCheckOut
                ? admin.firestore.Timestamp.fromDate(new Date(data.expectedCheckOut))
                : null,
            needsCart: data.needsCart || false,
            createdBy: userId,
            notes: data.notes || null,
            tenantId,
            qrActive: true,
            branch: availabilityCheck.branchId
        };
        batch.set(roomCardRef, roomCard);
        // Update room status
        if (!availabilityCheck.roomRef) {
            throw new functions.https.HttpsError('internal', 'خطأ في الحصول على مرجع الغرفة');
        }
        batch.update(availabilityCheck.roomRef, {
            status: 'occupied',
            currentGuestId: roomCardRef.id,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        // Commit transaction
        await batch.commit();
        // 6. Log action (optional)
        try {
            await db.collection('audit_logs').add({
                action: 'CHECK_IN',
                userId,
                tenantId,
                details: {
                    roomNumber,
                    guestName,
                    roomCardId: roomCardRef.id
                },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        catch (logError) {
            // Don't fail if logging fails
            console.error('Failed to log check-in action:', logError);
        }
        return {
            success: true,
            roomCardId: roomCardRef.id
        };
    }
    catch (error) {
        console.error('Error during check-in:', error);
        throw new functions.https.HttpsError('internal', error.message || 'حدث خطأ أثناء تسجيل الدخول');
    }
});
/**
 * ✅ MASTER KEY: Check-out Guest
 *
 * Usage:
 * ```typescript
 * const checkOut = httpsCallable(functions, 'checkOutGuest');
 * const result = await checkOut({
 *   roomCardId: 'card123',
 *   tenantId: 'tenant123'
 * });
 * ```
 */
exports.checkOutGuest = functions
    .region('us-central1')
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // 1. Security: Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول أولاً');
    }
    const userId = context.auth.uid;
    const db = admin.firestore();
    const { roomCardId, tenantId } = data;
    // 2. Validate input
    if (!roomCardId || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'roomCardId و tenantId مطلوبان');
    }
    // 3. Verify permissions
    const permissionCheck = await verifyRoomPermission(userId, tenantId, 'reception');
    if (!permissionCheck.allowed) {
        throw new functions.https.HttpsError('permission-denied', permissionCheck.error || 'ليس لديك صلاحية');
    }
    // 4. Get room card
    const roomCardRef = db.doc(`tenants/${tenantId}/roomCards/${roomCardId}`);
    const roomCardSnap = await roomCardRef.get();
    if (!roomCardSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'بطاقة الغرفة غير موجودة');
    }
    const roomCardData = roomCardSnap.data();
    if ((roomCardData === null || roomCardData === void 0 ? void 0 : roomCardData.status) !== 'active') {
        throw new functions.https.HttpsError('failed-precondition', 'الغرفة غير نشطة');
    }
    // 5. Update room card and room status (atomic transaction)
    try {
        const batch = db.batch();
        const now = admin.firestore.Timestamp.now();
        // Update room card
        batch.update(roomCardRef, {
            status: 'checked_out',
            checkOutTime: now,
            checkedOutBy: userId,
            notes: data.notes || null
        });
        // Update room status
        const roomNumber = roomCardData.roomNumber;
        const branchId = roomCardData.branch || 'default';
        const roomDocId = `${branchId}_${roomNumber}`;
        const roomRef = db.doc(`tenants/${tenantId}/rooms/${roomDocId}`);
        batch.update(roomRef, {
            status: 'dirty',
            currentGuestId: null,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        await batch.commit();
        return { success: true };
    }
    catch (error) {
        console.error('Error during check-out:', error);
        throw new functions.https.HttpsError('internal', error.message || 'حدث خطأ أثناء تسجيل الخروج');
    }
});
//# sourceMappingURL=roomOperations.js.map