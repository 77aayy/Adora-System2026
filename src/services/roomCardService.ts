/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Room Card Service
 * Manages guest check-in/check-out lifecycle
 * Adora Hotel Management System V2
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    query,
    where,
    getDocs,
    onSnapshot,
    Timestamp,
    orderBy,
    Unsubscribe,
    increment,
    runTransaction,
    serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';
import { RoomCard, CheckInData, RoomCardStatus } from '../types';
import { RoomStatus } from '../types/room';
import { calculateBellmanPoints } from '../utils/pointsCalculator';
import { updateRoomStatus } from './roomService';
import { retryFirestoreOperation } from '../utils/retry';
import { archiveChatRoom } from './smartChatService';
import { validateTenantAccess, validateTenantId } from './tenantSecurityService';
import { logger } from './loggerService';
import { logAction, LogAction } from './advancedLogService';

// ============================================================
// HELPERS
// ============================================================

/**
 * Convert Firestore document to RoomCard
 */
const mapDocToRoomCard = (doc: any): RoomCard => {
    const data = doc.data();
    return {
        id: doc.id,
        roomNumber: data.roomNumber,
        guestName: data.guestName,
        guestIdentity: data.guestIdentity,
        guestPhone: data.guestPhone,
        adults: data.adults || 1,
        children: data.children || 0,
        status: data.status as RoomCardStatus,
        checkInTime: data.checkInTime?.toDate() || new Date(),
        checkOutTime: data.checkOutTime?.toDate(),
        expectedCheckOut: data.expectedCheckOut?.toDate(),
        needsCart: data.needsCart || false,
        createdBy: data.createdBy || '',
        notes: data.notes,
    };
};

// ============================================================
// ROOM AVAILABILITY CHECK (CENTRALIZED)
// ============================================================

/**
 * ✅ CENTRALIZED: Check room availability and reserve it atomically
 * 
 * 🚀 MASTER KEY PATTERN: Uses Cloud Function for validation
 * 
 * This function is the SINGLE SOURCE OF TRUTH for room availability checks.
 * It now uses Cloud Function for validation (Master Key pattern).
 * 
 * Benefits:
 * - ✅ No race conditions (all checks inside transaction)
 * - ✅ Simpler Firebase Rules (just read-only, no complex validation)
 * - ✅ Centralized logic (change once, applies everywhere)
 * - ✅ Better security (Admin SDK bypasses Rules)
 * - ✅ Fallback to client-side if Function fails
 * 
 * @param roomNumber - Room number to check
 * @param tenantId - Tenant ID
 * @returns Room data if available, throws error if not
 */
export const checkRoomAvailability = async (
    roomNumber: string,
    tenantId: string
): Promise<{
    roomRef: any; // DocumentReference
    roomData: any; // Room data
    branchId: string;
}> => {
    // ✅ STEP 1: Try Cloud Function first (Master Key pattern)
    try {
        const functions = getFunctions();
        const checkAvailabilityFunction = httpsCallable(functions, 'checkRoomAvailability');
        
        const result = await checkAvailabilityFunction({
            roomNumber,
            tenantId
        });
        
        const data = result.data as { available: boolean; roomData?: any; branchId?: string; error?: string };
        
        if (data.available && data.roomData && data.branchId) {
            // ✅ Function succeeded - get room reference for client-side operations
            const validatedTenantId = validateTenantId(tenantId);
            const roomDocId = `${data.branchId}_${roomNumber}`;
            const roomRef = doc(db, `tenants/${validatedTenantId}/rooms`, roomDocId);
            
            return {
                roomRef,
                roomData: data.roomData,
                branchId: data.branchId
            };
        } else {
            // Function returned unavailable
            throw new Error(data.error || 'الغرفة غير متاحة');
        }
    } catch (error: any) {
        // ⚠️ Fallback: If Function fails, use client-side check (for backward compatibility)
        console.warn('Cloud Function checkRoomAvailability failed, falling back to client-side:', error);
        
        // Fallback to original client-side implementation
        return await checkRoomAvailabilityClientSide(roomNumber, tenantId);
    }
};

/**
 * ⚠️ FALLBACK: Client-side room availability check
 * This will be removed once Cloud Function is fully tested and deployed
 */
const checkRoomAvailabilityClientSide = async (
    roomNumber: string,
    tenantId: string
): Promise<{
    roomRef: any; // DocumentReference
    roomData: any; // Room data
    branchId: string;
}> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot check room availability', undefined, 'roomCardService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    const roomsRef = collection(db, `tenants/${validatedTenantId}/rooms`);
    const roomCardsRef = collection(db, `tenants/${validatedTenantId}/roomCards`);

    // ✅ STEP 1: Find room by number and check for active room cards (outside transaction)
    const roomQuery = query(roomsRef, where('number', '==', roomNumber));
    const roomSnapshot = await getDocs(roomQuery);

    if (roomSnapshot.empty) {
        throw new Error(`الغرفة رقم ${roomNumber} غير موجودة في النظام`);
    }

    const roomDoc = roomSnapshot.docs[0];
    const roomData = roomDoc.data();
    const branchId = roomData.branchId || roomData.branch || 'default';
    const roomDocId = `${branchId}_${roomNumber}`;
    const roomRef = doc(db, `tenants/${validatedTenantId}/rooms`, roomDocId);

    // ✅ STEP 1.5: Check for existing active room card (outside transaction - early validation)
    const activeCardQuery = query(
        roomCardsRef,
        where('roomNumber', '==', roomNumber),
        where('status', '==', 'active')
    );
    const activeCardSnapshot = await getDocs(activeCardQuery);

    if (!activeCardSnapshot.empty) {
        const existingCard = activeCardSnapshot.docs[0].data();
        throw new Error(
            `الغرفة رقم ${roomNumber} مشغولة بالفعل من قبل: ${existingCard.guestName}\n` +
            `تاريخ الدخول: ${existingCard.checkInTime?.toDate().toLocaleDateString('ar-SA')}`
        );
    }

    // ✅ STEP 2: ATOMIC TRANSACTION - Final validation and room status check inside transaction
    return await runTransaction(db, async (transaction) => {
        // 1. Get current room status INSIDE transaction (prevents race condition)
        const roomSnap = await transaction.get(roomRef);
        if (!roomSnap.exists()) {
            throw new Error(`الغرفة رقم ${roomNumber} غير موجودة`);
        }

        const currentRoomData = roomSnap.data();

        // 2. Check room status (final validation inside transaction)
        if (currentRoomData.status === 'occupied') {
            throw new Error(`الغرفة رقم ${roomNumber} مشغولة بالفعل`);
        }

        if (currentRoomData.status === 'maintenance') {
            throw new Error(`الغرفة رقم ${roomNumber} تحت الصيانة ولا يمكن حجزها`);
        }

        if (currentRoomData.status === 'dirty' || currentRoomData.status === 'cleaning') {
            throw new Error(`الغرفة رقم ${roomNumber} قيد التنظيف. يرجى الانتظار حتى تصبح جاهزة`);
        }

        // ✅ All checks passed - room is available
        return {
            roomRef,
            roomData: currentRoomData,
            branchId
        };
    });
};

// ============================================================
// CHECK-IN / CHECK-OUT
// ============================================================

/**
 * Check-in a guest
 * Creates room card and updates room status
 * 🔐 SECURITY: Validates tenant access and prevents double check-in
 * 🚀 MASTER KEY: Uses Cloud Function processCheckIn (with fallback to client-side)
 * 
 * This function now uses the Cloud Function for check-in operations:
 * - ✅ Better security (Admin SDK bypasses Rules)
 * - ✅ Atomic transactions (all steps in one transaction)
 * - ✅ Centralized logic (change once, applies everywhere)
 * - ✅ Fallback to client-side for backward compatibility
 */
export const checkIn = async (data: CheckInData, tenantId: string): Promise<string> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot check in', undefined, 'roomCardService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ STEP 1: Try Cloud Function first (Master Key pattern)
    try {
        const functions = getFunctions();
        const processCheckInFunction = httpsCallable(functions, 'processCheckIn');
        
        const result = await processCheckInFunction({
            roomNumber: data.roomNumber,
            guestData: {
                guestName: data.guestName,
                guestIdentity: data.guestIdentity || undefined,
                guestPhone: data.guestPhone || undefined,
                adults: data.adults,
                children: data.children,
                expectedCheckOut: data.expectedCheckOut ? data.expectedCheckOut.toISOString() : undefined,
                needsCart: data.needsCart || false,
                notes: data.notes || undefined
            },
            tenantId: validatedTenantId
        });
        
        const functionResult = result.data as { success: boolean; roomCardId?: string; error?: string };
        
        if (functionResult.success && functionResult.roomCardId) {
            // ✅ Function succeeded - generate QR token and award points
            const roomCardId = functionResult.roomCardId;
            
            // Generate QR token (non-critical, can fail)
            try {
                const { generateSecureAccessToken } = await import('./secureAccessService');
                const roomData = await getDoc(doc(db, `tenants/${validatedTenantId}/roomCards/${roomCardId}`));
                const roomCardData = roomData.data();
                const branchId = roomCardData?.branch || 'default';
                
                const { token } = await generateSecureAccessToken(
                    data.roomNumber,
                    branchId,
                    validatedTenantId,
                    data.createdBy || 'system',
                    {
                        expiresInHours: null,
                        maxDevices: 3,
                        roomCardId: roomCardId
                    }
                );
                
                await updateDoc(doc(db, `tenants/${validatedTenantId}/roomCards/${roomCardId}`), {
                    qrToken: token,
                    qrGeneratedAt: Timestamp.now()
                });
            } catch (qrError) {
                logger.warn('Failed to generate QR token (non-critical)', qrError, 'roomCardService');
            }
            
            // Award bellman points (non-critical)
            if (data.createdBy) {
                try {
                    const { awardBellmanPoints } = await import('./pointsService');
                    await awardBellmanPoints(data.createdBy, 'checkin', validatedTenantId);
                } catch (pointsError) {
                    logger.warn('Failed to award points (non-critical)', pointsError, 'roomCardService');
                }
            }
            
            return roomCardId;
        } else {
            throw new Error(functionResult.error || 'فشل تسجيل الدخول');
        }
    } catch (error: any) {
        // ⚠️ Fallback: If Function fails, use client-side check-in (for backward compatibility)
        console.warn('Cloud Function processCheckIn failed, falling back to client-side:', error);
        
        // Fallback to original client-side implementation
        return await checkInClientSide(data, validatedTenantId);
    }
};

/**
 * ⚠️ FALLBACK: Client-side check-in implementation
 * This will be removed once Cloud Function is fully tested and deployed
 */
const checkInClientSide = async (data: CheckInData, validatedTenantId: string): Promise<string> => {
    try {
        const now = Timestamp.now();

        // ✅ STEP 1: Use centralized availability check (atomic, prevents race conditions)
        const { roomRef, roomData, branchId } = await checkRoomAvailability(data.roomNumber, validatedTenantId);

        // ✅ STEP 2: Create room card and update room status in atomic transaction
        const roomCardsRef = collection(db, `tenants/${validatedTenantId}/roomCards`);
        const roomCardDocRef = doc(roomCardsRef); // Pre-generate ID for transaction
        
        const roomCard = {
            roomNumber: data.roomNumber,
            guestName: data.guestName,
            guestIdentity: data.guestIdentity || null,
            guestPhone: data.guestPhone || null,
            adults: data.adults,
            children: data.children,
            status: 'active' as RoomCardStatus,
            checkInTime: now,
            checkOutTime: null,
            expectedCheckOut: data.expectedCheckOut ? Timestamp.fromDate(data.expectedCheckOut) : null,
            needsCart: data.needsCart || false,
            createdBy: data.createdBy,
            notes: data.notes || null,
            tenantId: validatedTenantId, // ✅ Save tenantId
            qrActive: true, // ✅ Enable QR access when room is checked in
            branch: branchId // ✅ Save branch for QR checks
        };

        // ✅ ATOMIC TRANSACTION: Create room card + Update room status (room availability already checked)
        const docRef = await runTransaction(db, async (transaction) => {
            // 1. Double-check room is still available (defense in depth)
            const roomSnap = await transaction.get(roomRef);
            if (!roomSnap.exists()) {
                throw new Error(`الغرفة رقم ${data.roomNumber} غير موجودة`);
            }
            
            const currentRoomData = roomSnap.data();
            if (currentRoomData.status === 'occupied') {
                throw new Error(`الغرفة رقم ${data.roomNumber} مشغولة بالفعل`);
            }
            
            // 2. Create room card INSIDE transaction (atomic operation)
            transaction.set(roomCardDocRef, roomCard);
            
            // 3. Update room status + link guest ID INSIDE same transaction (atomic operation)
            transaction.update(roomRef, {
                status: 'occupied' as RoomStatus,
                currentGuestId: roomCardDocRef.id,
                lastUpdated: serverTimestamp()
            });
            
            return roomCardDocRef; // Return doc reference
        });

        // ✅ STEP 3: Generate secure QR token automatically on check-in
        try {
            const { generateSecureAccessToken } = await import('./secureAccessService');
            
            // Generate QR token for this room (linked to room card)
            const { token } = await generateSecureAccessToken(
                data.roomNumber,
                branchId,
                validatedTenantId,
                data.createdBy || 'system',
                {
                    expiresInHours: null, // Never expires (until checkout)
                    maxDevices: 3,
                    roomCardId: docRef.id // Link to room card
                }
            );
            
            // Store token in room card for easy access
            await updateDoc(docRef, {
                qrToken: token,
                qrGeneratedAt: now
            });
            
            console.log(`🔐 QR token generated automatically for Room ${data.roomNumber} on check-in`);
        } catch (qrError) {
            // Non-critical: Log warning but don't fail check-in
            logger.warn('Failed to generate QR token on check-in (non-critical)', qrError, 'roomCardService');
        }

        // ✅ STEP 4: Award bellman points for check-in (ATOMIC: Uses runTransaction to prevent Race Condition)
        if (data.createdBy) {
            try {
                const points = calculateBellmanPoints('check-in');
                // ✅ FIX: Use runTransaction to prevent race condition when multiple check-ins happen simultaneously
                const userRef = doc(db, `tenants/${validatedTenantId}/employees`, data.createdBy);
                // Try employees collection first, fallback to users collection
                await runTransaction(db, async (transaction) => {
                    const userSnap = await transaction.get(userRef);
                    if (userSnap.exists()) {
                        const currentPoints = userSnap.data()?.points || userSnap.data()?.currentPoints || 0;
                        transaction.update(userRef, {
                            points: currentPoints + points,
                            currentPoints: currentPoints + points  // Sync both fields
                        });
                    } else {
                        // Fallback to users collection (backward compatibility)
                        const legacyUserRef = doc(db, 'users', data.createdBy);
                        const legacyUserSnap = await transaction.get(legacyUserRef);
                        if (legacyUserSnap.exists()) {
                            const currentPoints = legacyUserSnap.data()?.points || 0;
                            transaction.update(legacyUserRef, {
                                points: currentPoints + points
                            });
                        }
                    }
                });
            } catch (err) {
                console.warn('Could not update employee points:', err);
                logger.warn('Failed to award bellman points on check-in', err, 'roomCardService');
            }
        }

        // 📝 Audit Log: Guest Check-in
        try {
            const storedUser = localStorage.getItem('adora_user');
            const userData = storedUser ? JSON.parse(storedUser) : {};
            await logAction(
                'GUEST_CHECKIN' as LogAction,
                {
                    id: data.createdBy || userData.id || 'system',
                    name: userData.name || 'System',
                    role: userData.role || 'bellman',
                    department: userData.department || 'bellman'
                },
                {
                    type: 'room_card',
                    id: docRef.id,
                    name: `بطاقة غرفة ${data.roomNumber} - ${data.guestName}`
                },
                {
                    tenantId: validatedTenantId,
                    branchId: branchId,
                    roomNumber: data.roomNumber
                },
                {
                    description: `تم تسجيل دخول النزيل ${data.guestName} إلى الغرفة ${data.roomNumber}`,
                    previousValue: roomData.status || 'available',
                    newValue: 'occupied',
                    metadata: { 
                        guestName: data.guestName, 
                        guestIdentity: data.guestIdentity,
                        adults: data.adults,
                        children: data.children,
                        roomCardId: docRef.id
                    }
                }
            ).catch(err => logger.warn('Failed to log guest check-in', err, 'roomCardService'));
        } catch (auditError) {
            logger.warn('Failed to create audit log for guest check-in', auditError, 'roomCardService');
        }

        return docRef.id;
    } catch (error: any) {
        console.error('Check-in failed:', error);

        // Return specific error message if available
        if (error.message && error.message.includes('الغرفة')) {
            throw error; // Our custom error messages
        }

        // Generic fallback
        throw new Error('فشل تسجيل الدخول. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني');
    }
};

/**
 * Check-out a guest
 * Updates room card to checkout_pending and creates inspection request
 * Flow: Bellman → Reception (PENDING_RECEPTION) → Housekeeping → Reception
 */
export const checkOut = async (
    cardId: string,
    roomNumber: string,
    tenantId: string,
    employeeId?: string,
    employeeName?: string,
    options?: {
        guestsInRoom?: boolean;
        receptionistId?: string;
        receptionistName?: string;
        notes?: string;
    }
): Promise<string | null> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot check out', undefined, 'roomCardService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ Use tenant-scoped collection
    const roomCardsRef = collection(db, `tenants/${validatedTenantId}/roomCards`);
    const cardRef = doc(roomCardsRef, cardId);
    const now = Timestamp.now();

    try {
        // Get card data first
        const cardSnap = await getDocs(query(
            roomCardsRef,
            where('__name__', '==', cardId)
        ));

        const cardData = cardSnap.empty ? null : cardSnap.docs[0].data();

        // 1. Update room card to checkout_pending (not fully checked_out until inspection done)
        await updateDoc(cardRef, {
            status: 'checkout_pending',
            checkOutTime: now,
            checkoutBy: employeeId ? { id: employeeId, name: employeeName || '' } : null,
            guestsInRoom: options?.guestsInRoom || false,
            qrActive: false
        });

        // 🔐 SECURITY: Deactivate all QR tokens for this room on checkout
        // This ensures tokens become invalid immediately when guest checks out
        try {
            const { deactivateTokenOnCheckout } = await import('./secureAccessService');
            const branchId = cardData?.branch || cardData?.branchId || 'default';
            await deactivateTokenOnCheckout(roomNumber, branchId, validatedTenantId);
            console.log(`🔐 QR tokens deactivated for Room ${roomNumber} on checkout`);
        } catch (tokenError) {
            console.warn('⚠️ Failed to deactivate tokens on checkout (non-critical):', tokenError);
            // Don't fail checkout if token deactivation fails
        }

        // 2. Create inspection request (goes directly to Housekeeping)
        const inspectionRequest = {
            roomNumber,
            branch: cardData?.branch || 'default',
            tenantId: validatedTenantId, // ✅ Include tenantId
            hotelId: cardData?.hotelId || null,
            serviceType: 'inspection',
            requestType: 'inspection',
            type: 'inspection', // ✅ Add type field for compatibility
            source: 'bellman_checkout',
            status: 'CONFIRMED', // ✅ Go directly to housekeeping (confirmed)
            currentDepartment: 'housekeeping', // ✅ Send directly to housekeeping
            originDepartment: 'bellman', // ✅ Track origin
            roomCardId: cardId, // Link to card

            // Guest info
            guestCount: {
                adults: cardData?.adults || 1,
                children: cardData?.children || 0
            },
            guestName: cardData?.guestName || null,
            guestsInRoom: options?.guestsInRoom || false, // Alert for reception

            // Check-in data
            checkinBy: cardData?.createdBy ? { id: cardData.createdBy, name: '' } : null,
            checkinAt: cardData?.checkInTime || null,
            checkinNotes: cardData?.notes || null,

            // Check-out data
            checkoutBy: employeeId ? { id: employeeId, name: employeeName || '' } : null,
            checkoutAt: now,
            checkoutNotes: options?.notes || null,

            // Assigned receptionist
            assignedReceptionist: options?.receptionistId ? {
                id: options.receptionistId,
                name: options.receptionistName || ''
            } : null,

            // Created by
            createdBy: employeeId ? { id: employeeId, name: employeeName || '' } : null,
            createdAt: now,

            // Timeline
            timeline: {
                created: now
            }
        };

        // ✅ FIX #3: Offline Safety - Store inspection request ID in room card for recovery
        let inspectionRefId: string | null = null;

        try {
            // ✅ Use tenant-scoped collection
            const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);
            const inspectionRef = await retryFirestoreOperation(
                () => addDoc(requestsRef, inspectionRequest),
                'Create inspection request'
            );
            inspectionRefId = inspectionRef.id;
            console.log('✅ Inspection request created:', inspectionRefId);

            // ✅ Immediately link inspection ID to room card (for recovery if network drops)
            await updateDoc(cardRef, {
                inspectionRequestId: inspectionRefId
            });
        } catch (error: any) {
            // ✅ Offline Safety: If network fails, save to localStorage for retry
            console.error('Failed to create inspection request:', error);

            // Check if it's a network error
            const isNetworkError = error?.code === 'unavailable' ||
                error?.message?.toLowerCase().includes('network') ||
                error?.message?.toLowerCase().includes('offline');

            if (isNetworkError) {
                // Save to offline queue
                try {
                    const offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
                    offlineQueue.push({
                        type: 'checkout_inspection',
                        cardId,
                        roomNumber,
                        employeeId,
                        employeeName,
                        inspectionRequest,
                        timestamp: Date.now(),
                        retries: 0
                    });
                    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));

                    // Return error with recovery message
                    throw new Error('تم حفظ طلب الفحص محلياً. سيتم إرساله تلقائياً عند عودة الاتصال بالإنترنت');
                } catch (storageError) {
                    console.error('Failed to save to offline queue:', storageError);
                    throw new Error('فشل إنشاء طلب الفحص. يرجى المحاولة مرة أخرى');
                }
            } else {
                // Non-network error - rethrow
                throw error;
            }
        }

        // 📝 Audit Log: Guest Check-out
        try {
            const storedUser = localStorage.getItem('adora_user');
            const userData = storedUser ? JSON.parse(storedUser) : {};
            const branchId = cardData?.branch || cardData?.branchId || 'default';
            await logAction(
                'GUEST_CHECKOUT' as LogAction,
                {
                    id: employeeId || userData.id || 'system',
                    name: employeeName || userData.name || 'System',
                    role: userData.role || 'bellman',
                    department: userData.department || 'bellman'
                },
                {
                    type: 'room_card',
                    id: cardId,
                    name: `بطاقة غرفة ${roomNumber} - ${cardData?.guestName || 'نزيل'}`
                },
                {
                    tenantId: validatedTenantId,
                    branchId: branchId,
                    roomNumber: roomNumber
                },
                {
                    description: `تم تسجيل خروج النزيل ${cardData?.guestName || 'نزيل'} من الغرفة ${roomNumber}`,
                    previousValue: cardData?.status || 'active',
                    newValue: 'checkout_pending',
                    metadata: { 
                        guestName: cardData?.guestName,
                        guestIdentity: cardData?.guestIdentity,
                        inspectionRequestId: inspectionRefId,
                        checkoutBy: employeeName
                    }
                }
            ).catch(err => logger.warn('Failed to log guest check-out', err, 'roomCardService'));
        } catch (auditError) {
            logger.warn('Failed to create audit log for guest check-out', auditError, 'roomCardService');
        }

        // 3. Update room status to DIRTY (needs cleaning after checkout) - SaaS aware
        try {
            const branchId = cardData?.branch || 'default';
            const effectiveTenantId = tenantId || cardData?.tenantId;
            if (effectiveTenantId) {
                await updateRoomStatus(effectiveTenantId, branchId, roomNumber, 'dirty' as RoomStatus);
            } else {
                // Legacy fallback (global collection)
                // No-op here to avoid inconsistent paths; housekeeping will set status via requests
            }
        } catch (err) {
            console.warn('Could not update room status:', err);
        }

        // 4. Create rating invitation (if template exists)
        try {
            const { createRatingInvitation } = await import('./ratingService');
            await createRatingInvitation(
                roomNumber,
                cardData?.branch || 'default',
                tenantId || cardData?.tenantId || '',
                'checkout',
                {
                    checkoutAt: now,
                    checkoutBy: employeeName || '',
                    roomNumber
                },
                cardData?.guestName || null
            );
        } catch (ratingError) {
            // Don't fail checkout if rating invitation fails
            console.warn('Could not create rating invitation:', ratingError);
        }

        // 5. Award bellman points
        if (employeeId) {
            try {
                const points = calculateBellmanPoints('check-out');
                const userRef = doc(db, 'users', employeeId);
                await updateDoc(userRef, {
                    points: increment(points),
                });
            } catch (err) {
                console.warn('Could not update employee points:', err);
            }
        }
        
        // 6. ✅ أرشفة الشات تلقائياً عند الخروج (تنظيف + خصوصية)
        try {
            const branchId = cardData?.branch || 'default';
            await archiveChatRoom(validatedTenantId, branchId, roomNumber);
            console.log(`✅ Chat archived for room ${roomNumber}`);
        } catch (chatError) {
            // لا نفشل الخروج لو فشلت أرشفة الشات
            console.warn('Could not archive chat room:', chatError);
        }

        // 7. ✅ تنظيف بيانات Rate Limit للنزيل (خصوصية + توفير مساحة)
        try {
            const { cleanupGuestRateLimitOnCheckout } = await import('./anonymousAuthService');
            const cleanupResult = await cleanupGuestRateLimitOnCheckout(validatedTenantId, roomNumber);
            if (cleanupResult.deletedCount > 0) {
                console.log(`🗑️ Guest rate limit cleanup: ${cleanupResult.deletedCount} record(s) deleted`);
            }
        } catch (cleanupError) {
            // لا نفشل الخروج لو فشل التنظيف
            console.warn('Could not cleanup guest rate limits:', cleanupError);
        }

        // Return inspection request ID (or null if failed and queued offline)
        return inspectionRefId;
    } catch (error) {
        console.error('Checkout error:', error);
        return null;
    }
};

// ============================================================
// BILLING & CHARGES
// ============================================================

/**
 * Add charge to Room Card
 * 🔐 SECURITY: Validates tenant access
 * ✅ ATOMIC: Uses runTransaction to prevent Race Conditions
 * Automatically links charge to Room Card for final billing
 */
export const addChargeToRoomCard = async (
    tenantId: string,
    branchId: string,
    roomCardId: string,
    roomNumber: string,
    charge: {
        type: 'minibar' | 'coffee_shop' | 'laundry' | 'room_service' | 'other';
        description: string;
        amount: number;
        currency?: string;
        requestId?: string;
        items?: Array<{ name: string; quantity: number; price: number }>;
    },
    recordedBy?: string,
    recordedByName?: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot add charge to room card', undefined, 'roomCardService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ ATOMIC TRANSACTION: Add charge to Room Card + Update financial tracking
    await runTransaction(db, async (transaction) => {
        // 1. Verify Room Card exists and is active
        const roomCardRef = doc(db, `tenants/${validatedTenantId}/roomCards`, roomCardId);
        const roomCardSnap = await transaction.get(roomCardRef);

        if (!roomCardSnap.exists()) {
            throw new Error(`Room Card ${roomCardId} not found`);
        }

        const roomCardData = roomCardSnap.data();

        if (roomCardData.status !== 'active') {
            throw new Error(`لا يمكن إضافة رسوم لبطاقة غرفة غير نشطة (الحالة: ${roomCardData.status})`);
        }

        // 2. Create financial transaction record
        const transactionsRef = collection(db, `tenants/${validatedTenantId}/branches/${branchId}/financial_transactions`);
        const transactionRef = doc(transactionsRef);
        transaction.set(transactionRef, {
            tenantId: validatedTenantId,
            branchId,
            roomNumber,
            roomCardId, // ✅ Link to Room Card
            guestId: roomCardData.guestId || null,
            guestName: roomCardData.guestName || null,
            type: charge.type as 'room_service' | 'minibar' | 'laundry' | 'other' | 'penalty' | 'bonus',
            category: charge.type,
            description: charge.description,
            amount: charge.amount,
            currency: charge.currency || 'SAR',
            status: 'pending',
            requestId: charge.requestId || null,
            employeeId: recordedBy || null,
            employeeName: recordedByName || null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        // 3. Update Room Bill Summary (atomic increment)
        const roomBillRef = doc(db, `tenants/${validatedTenantId}/branches/${branchId}/room_bills`, roomNumber);
        const roomBillSnap = await transaction.get(roomBillRef);

        if (roomBillSnap.exists()) {
            transaction.update(roomBillRef, {
                pendingAmount: increment(charge.amount),
                totalAmount: increment(charge.amount),
                lastUpdated: serverTimestamp()
            });
        } else {
            transaction.set(roomBillRef, {
                roomNumber,
                guestName: roomCardData.guestName || null,
                totalAmount: charge.amount,
                pendingAmount: charge.amount,
                confirmedAmount: 0,
                paidAmount: 0,
                lastUpdated: serverTimestamp()
            });
        }

        logger.info(`✅ ATOMIC: Charge added to Room Card ${roomCardId}. Amount: ${charge.amount} SAR`, undefined, 'roomCardService');
    });
};

// ============================================================
// QUERIES
// ============================================================

/**
 * Get active room card for a room
 * 🔐 SECURITY: Validates tenant access
 */
export const getActiveRoomCard = async (roomNumber: string, tenantId: string): Promise<RoomCard | null> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get active room card', undefined, 'roomCardService');
        return null;
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ Use tenant-scoped collection
    const roomCardsRef = collection(db, `tenants/${validatedTenantId}/roomCards`);
    const constraints: any[] = [
        where('roomNumber', '==', roomNumber),
        where('status', '==', 'active')
    ];

    const q = query(roomCardsRef, ...constraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    return mapDocToRoomCard(snapshot.docs[0]);
};

/**
 * Subscribe to active room cards (real-time)
 * 🔐 SECURITY: Validates tenant access
 * ✅ SECURITY FIX: Now requires branchId for proper data isolation
 * Prevents duplicate Room Cards from other branches
 */
export const subscribeToActiveRoomCards = (
    callback: (cards: RoomCard[]) => void,
    tenantId: string,
    branchId?: string
): Unsubscribe => {
    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to room cards', undefined, 'roomCardService');
        callback([]);
        return () => { };
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ Use tenant-scoped collection
    const roomCardsRef = collection(db, `tenants/${validatedTenantId}/roomCards`);
    const constraints: any[] = [where('status', '==', 'active')];
    
    // ✅ CRITICAL FIX: Filter by branchId to prevent duplicates from other branches
    if (branchId) {
        // Try both 'branch' and 'branchId' fields for backward compatibility
        constraints.push(where('branch', '==', branchId));
    }

    const q = query(roomCardsRef, ...constraints);

    return onSnapshot(q, (snapshot) => {
        const cards = snapshot.docs.map(mapDocToRoomCard);
        // ✅ Additional client-side filter for branchId (safety net)
        const filteredCards = branchId 
            ? cards.filter(card => {
                // Check both 'branch' and 'branchId' fields
                const cardBranch = (card as any).branch || (card as any).branchId;
                return cardBranch === branchId;
            })
            : cards;
        
        // Sort client-side
        filteredCards.sort((a, b) => {
            const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
            const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
            return timeB - timeA;
        });
        callback(filteredCards);
    });
};

/**
 * Subscribe to today's room cards (for stats)
 * 🔐 SECURITY: Validates tenant access
 */
export const subscribeToTodayRoomCards = (
    callback: (cards: RoomCard[]) => void,
    tenantId: string
): Unsubscribe => {
    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to today room cards', undefined, 'roomCardService');
        callback([]);
        return () => { };
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ Use tenant-scoped collection
    const roomCardsRef = collection(db, `tenants/${validatedTenantId}/roomCards`);

    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const constraints: any[] = [
        where('checkInTime', '>=', Timestamp.fromDate(today))
    ];

    const q = query(
        roomCardsRef,
        ...constraints,
        orderBy('checkInTime', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const cards = snapshot.docs.map(mapDocToRoomCard);
        callback(cards);
    });
};
