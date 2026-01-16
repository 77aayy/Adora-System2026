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
import { db } from './firebase';
import { RoomCard, CheckInData, RoomCardStatus } from '../types';
import { RoomStatus } from '../types/room';
import { calculateBellmanPoints } from '../utils/pointsCalculator';
import { updateRoomStatus } from './roomService';
import { retryFirestoreOperation } from '../utils/retry';
import { archiveChatRoom } from './smartChatService'; // ✅ أرشفة الشات عند الخروج

// Collection references
const ROOM_CARDS_COLLECTION = 'roomCards';
const ROOMS_COLLECTION = 'rooms';

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
// CHECK-IN / CHECK-OUT
// ============================================================

/**
 * Check-in a guest
 * Creates room card and updates room status
 * ✅ SECURITY: Prevents double check-in
 */
export const checkIn = async (data: CheckInData, tenantId?: string): Promise<string> => {
    try {
        const roomCardsRef = collection(db, ROOM_CARDS_COLLECTION);
        const now = Timestamp.now();

        // ✅ STEP 1: Validate that room exists and is available (SaaS aware)
        // Use tenant-scoped collection when tenantId is provided
        const roomsRef = tenantId
            ? collection(db, `tenants/${tenantId}/rooms`)
            : collection(db, ROOMS_COLLECTION);
        const constraints: any[] = [where('number', '==', data.roomNumber)];
        if (tenantId) constraints.push(where('tenantId', '==', tenantId));

        const roomQuery = query(roomsRef, ...constraints);
        const roomSnapshot = await getDocs(roomQuery);

        if (roomSnapshot.empty) {
            throw new Error(`الغرفة رقم ${data.roomNumber} غير موجودة في النظام`);
        }

        const roomDoc = roomSnapshot.docs[0];
        const roomData = roomDoc.data();

        // Check if room is available
        if (roomData.status === 'occupied') {
            throw new Error(`الغرفة رقم ${data.roomNumber} مشغولة بالفعل`);
        }

        if (roomData.status === 'maintenance') {
            throw new Error(`الغرفة رقم ${data.roomNumber} تحت الصيانة ولا يمكن حجزها`);
        }

        if (roomData.status === 'dirty' || roomData.status === 'cleaning') {
            throw new Error(`الغرفة رقم ${data.roomNumber} قيد التنظيف. يرجى الانتظار حتى تصبح جاهزة`);
        }

        // ✅ STEP 2: Check for existing active room card (double check-in prevention)
        let activeCardConstraints = [
            where('roomNumber', '==', data.roomNumber),
            where('status', '==', 'active')
        ];
        if (tenantId) activeCardConstraints.push(where('tenantId', '==', tenantId));

        const activeCardQuery = query(roomCardsRef, ...activeCardConstraints);
        const activeCardSnapshot = await getDocs(activeCardQuery);

        if (!activeCardSnapshot.empty) {
            const existingCard = activeCardSnapshot.docs[0].data();
            throw new Error(
                `الغرفة رقم ${data.roomNumber} مشغولة بالفعل من قبل: ${existingCard.guestName}\n` +
                `تاريخ الدخول: ${existingCard.checkInTime?.toDate().toLocaleDateString('ar-SA')}`
            );
        }

        // ✅ STEP 3: Create room card (now safe)
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
            tenantId: tenantId || null, // ✅ Save tenantId
            qrActive: true, // ✅ Enable QR access when room is checked in
            branch: roomData.branchId || roomData.branch || 'default' // ✅ Save branch for QR checks
        };

        // Create room card with retry
        const docRef = await retryFirestoreOperation(
            () => addDoc(roomCardsRef, roomCard),
            'Create room card'
        );

        // ✅ STEP 4: Update room status to occupied (SaaS aware)
        try {
            const branchId = roomData.branchId || roomData.branch || 'default';
            if (tenantId) {
                await updateRoomStatus(tenantId, branchId, data.roomNumber, 'occupied' as RoomStatus);
                // Link current guest id
                await updateDoc(doc(db, `tenants/${tenantId}/rooms`, `${branchId}_${data.roomNumber}`), {
                    currentGuestId: docRef.id,
                    lastUpdated: now
                });
            } else {
                // Legacy path fallback
                await updateDoc(doc(db, ROOMS_COLLECTION, roomDoc.id), {
                    status: 'occupied',
                    currentGuestId: docRef.id,
                    lastUpdated: now
                });
            }
        } catch (err) {
            // Rollback: delete the room card if room update fails
            console.error('Failed to update room status, rolling back:', err);
            await retryFirestoreOperation(
                () => updateDoc(doc(db, ROOM_CARDS_COLLECTION, docRef.id), {
                    status: 'cancelled'
                }),
                'Rollback room card'
            );
            throw new Error('فشل تحديث حالة الغرفة. تم إلغاء عملية تسجيل الدخول');
        }

        // ✅ STEP 5: Award bellman points for check-in
        if (data.createdBy) {
            try {
                const points = calculateBellmanPoints('check-in');
                const userRef = doc(db, 'users', data.createdBy);
                await updateDoc(userRef, {
                    points: increment(points),
                });
            } catch (err) {
                console.warn('Could not update employee points:', err);
            }
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
    employeeId?: string,
    employeeName?: string,
    options?: {
        guestsInRoom?: boolean;
        receptionistId?: string;
        receptionistName?: string;
        notes?: string;
    },
    tenantId?: string // ✅ optional tenantId
): Promise<string | null> => {
    const cardRef = doc(db, ROOM_CARDS_COLLECTION, cardId);
    const now = Timestamp.now();

    try {
        // Get card data first
        const cardSnap = await getDocs(query(
            collection(db, ROOM_CARDS_COLLECTION),
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
            const finalTenantId = tenantId || cardData?.tenantId || cardData?.hotelId || 'default';
            await deactivateTokenOnCheckout(roomNumber, branchId, finalTenantId);
            console.log(`🔐 QR tokens deactivated for Room ${roomNumber} on checkout`);
        } catch (tokenError) {
            console.warn('⚠️ Failed to deactivate tokens on checkout (non-critical):', tokenError);
            // Don't fail checkout if token deactivation fails
        }

        // 2. Create inspection request (goes directly to Housekeeping)
        const inspectionRequest = {
            roomNumber,
            branch: cardData?.branch || 'default',
            tenantId: tenantId || cardData?.tenantId, // ✅ Include tenantId
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
            const inspectionRef = await retryFirestoreOperation(
                () => addDoc(collection(db, 'requests'), inspectionRequest),
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
            const effectiveTenantId = tenantId || cardData?.tenantId;
            const branchId = cardData?.branch || 'default';
            if (effectiveTenantId) {
                await archiveChatRoom(effectiveTenantId, branchId, roomNumber);
                console.log(`✅ Chat archived for room ${roomNumber}`);
            }
        } catch (chatError) {
            // لا نفشل الخروج لو فشلت أرشفة الشات
            console.warn('Could not archive chat room:', chatError);
        }

        // 7. ✅ تنظيف بيانات Rate Limit للنزيل (خصوصية + توفير مساحة)
        try {
            const effectiveTenantId = tenantId || cardData?.tenantId;
            if (effectiveTenantId) {
                const { cleanupGuestRateLimitOnCheckout } = await import('./anonymousAuthService');
                const cleanupResult = await cleanupGuestRateLimitOnCheckout(effectiveTenantId, roomNumber);
                if (cleanupResult.deletedCount > 0) {
                    console.log(`🗑️ Guest rate limit cleanup: ${cleanupResult.deletedCount} record(s) deleted`);
                }
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
// QUERIES
// ============================================================

/**
 * Get active room card for a room
 */
export const getActiveRoomCard = async (roomNumber: string, tenantId?: string): Promise<RoomCard | null> => {
    const roomCardsRef = collection(db, ROOM_CARDS_COLLECTION);
    const constraints: any[] = [
        where('roomNumber', '==', roomNumber),
        where('status', '==', 'active')
    ];
    if (tenantId) constraints.push(where('tenantId', '==', tenantId));

    const q = query(roomCardsRef, ...constraints);
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    return mapDocToRoomCard(snapshot.docs[0]);
};

/**
 * Subscribe to active room cards (real-time)
 */
/**
 * ✅ SECURITY FIX: Now requires branchId for proper data isolation
 * Prevents duplicate Room Cards from other branches
 */
export const subscribeToActiveRoomCards = (
    callback: (cards: RoomCard[]) => void,
    tenantId?: string,
    branchId?: string
): Unsubscribe => {
    const roomCardsRef = collection(db, ROOM_CARDS_COLLECTION);
    const constraints: any[] = [where('status', '==', 'active')];

    if (tenantId) constraints.push(where('tenantId', '==', tenantId));
    
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
 */
export const subscribeToTodayRoomCards = (
    callback: (cards: RoomCard[]) => void,
    tenantId?: string
): Unsubscribe => {
    const roomCardsRef = collection(db, ROOM_CARDS_COLLECTION);

    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const constraints: any[] = [
        where('checkInTime', '>=', Timestamp.fromDate(today))
    ];

    if (tenantId) constraints.push(where('tenantId', '==', tenantId));

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
