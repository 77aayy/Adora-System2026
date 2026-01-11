/**
 * Identity Check Service
 * Handles guest identity verification for both Reception and Guest QR flows
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import { 
    collection, doc, getDoc, setDoc, updateDoc, query, where, 
    getDocs, Timestamp, serverTimestamp, increment
} from 'firebase/firestore';
import { logger } from './loggerService';
import { notifyReceptionOfSuspiciousActivity } from './locationService';

// ============================================================
// TYPES
// ============================================================

export interface IdentityVerification {
    id: string;
    tenantId: string;
    branchId: string;
    roomNumber: string;
    requestId?: string;
    guestName: string;
    guestPhone: string; // Full phone number stored in room card
    phoneLastFour: string; // Last 4 digits for verification
    verificationType: 'reception_confirm' | 'guest_qr';
    status: 'pending' | 'verified' | 'failed' | 'blocked';
    failedAttempts: number;
    maxAttempts: number;
    verifiedBy?: { id: string; name: string };
    verifiedAt?: Timestamp;
    blockedAt?: Timestamp;
    blockedUntil?: Timestamp;
    createdAt: Timestamp;
}

export interface RoomBlockStatus {
    isBlocked: boolean;
    blockedUntil?: Date;
    remainingMinutes?: number;
    reason?: string;
}

export interface VerificationResult {
    success: boolean;
    isBlocked?: boolean;
    remainingAttempts?: number;
    message: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const MAX_VERIFICATION_ATTEMPTS = 3;
const BLOCK_DURATION_MINUTES = 10;
const VERIFICATION_COLLECTION = 'identityVerifications';
const ROOM_BLOCKS_COLLECTION = 'roomBlocks';

// ============================================================
// RECEPTION IDENTITY CONFIRMATION
// ============================================================

/**
 * Confirm guest identity by reception staff
 * This should be called when reception confirms a request
 */
export async function confirmGuestIdentity(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    requestId: string,
    confirmedBy: { id: string; name: string },
    guestName: string
): Promise<VerificationResult> {
    try {
        logger.info(`Reception confirming identity for room ${roomNumber}`, null, 'identityCheckService');

        // Create verification record
        const verificationRef = doc(collection(db, VERIFICATION_COLLECTION));
        const verification: Omit<IdentityVerification, 'id'> = {
            tenantId,
            branchId,
            roomNumber,
            requestId,
            guestName,
            guestPhone: '', // Not needed for reception confirmation
            phoneLastFour: '',
            verificationType: 'reception_confirm',
            status: 'verified',
            failedAttempts: 0,
            maxAttempts: 1,
            verifiedBy: confirmedBy,
            verifiedAt: Timestamp.now(),
            createdAt: Timestamp.now()
        };

        await setDoc(verificationRef, { id: verificationRef.id, ...verification });

        // Update the request with identity confirmation
        if (requestId) {
            const requestRef = doc(db, 'requests', requestId);
            await updateDoc(requestRef, {
                identityConfirmed: true,
                identityConfirmedBy: confirmedBy,
                identityConfirmedAt: serverTimestamp()
            });
        }

        logger.info(`Identity confirmed for room ${roomNumber} by ${confirmedBy.name}`, null, 'identityCheckService');

        return {
            success: true,
            message: `تم تأكيد هوية النزيل في الغرفة ${roomNumber}`
        };
    } catch (error) {
        logger.error('Error confirming identity:', error, 'identityCheckService');
        return {
            success: false,
            message: 'فشل تأكيد الهوية. حاول مرة أخرى.'
        };
    }
}

// ============================================================
// GUEST QR PHONE VERIFICATION
// ============================================================

/**
 * Get the last 4 digits of guest phone from room card
 */
async function getGuestPhoneLastFour(
    tenantId: string,
    branchId: string,
    roomNumber: string
): Promise<{ phoneLastFour: string; fullPhone: string; guestName: string } | null> {
    try {
        // Query room card
        const roomCardsRef = collection(db, 'roomCards');
        const q = query(
            roomCardsRef,
            where('tenantId', '==', tenantId),
            where('branch', '==', branchId),
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active'),
            where('qrActive', '==', true)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            logger.warn(`No active room card found for room ${roomNumber}`, null, 'identityCheckService');
            return null;
        }

        const roomCard = snapshot.docs[0].data();
        const guestPhone = roomCard.guestPhone || '';
        const phoneLastFour = guestPhone.replace(/\D/g, '').slice(-4);
        
        return {
            phoneLastFour,
            fullPhone: guestPhone,
            guestName: roomCard.guestName || 'نزيل'
        };
    } catch (error) {
        logger.error('Error getting guest phone:', error, 'identityCheckService');
        return null;
    }
}

/**
 * Check if a room is currently blocked due to failed verification attempts
 */
export async function checkRoomBlockStatus(
    tenantId: string,
    branchId: string,
    roomNumber: string
): Promise<RoomBlockStatus> {
    try {
        const blockId = `${tenantId}_${branchId}_${roomNumber}`;
        const blockRef = doc(db, ROOM_BLOCKS_COLLECTION, blockId);
        const blockSnap = await getDoc(blockRef);

        if (!blockSnap.exists()) {
            return { isBlocked: false };
        }

        const blockData = blockSnap.data();
        const blockedUntil = blockData.blockedUntil?.toDate();
        const now = new Date();

        if (blockedUntil && blockedUntil > now) {
            const remainingMinutes = Math.ceil((blockedUntil.getTime() - now.getTime()) / 60000);
            return {
                isBlocked: true,
                blockedUntil,
                remainingMinutes,
                reason: blockData.reason || 'تم حظر الغرفة مؤقتاً بسبب محاولات تحقق فاشلة'
            };
        }

        return { isBlocked: false };
    } catch (error) {
        logger.error('Error checking room block status:', error, 'identityCheckService');
        return { isBlocked: false };
    }
}

/**
 * Block a room due to failed verification attempts
 */
async function blockRoom(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    reason: string
): Promise<void> {
    try {
        const blockId = `${tenantId}_${branchId}_${roomNumber}`;
        const blockRef = doc(db, ROOM_BLOCKS_COLLECTION, blockId);
        const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000);

        await setDoc(blockRef, {
            tenantId,
            branchId,
            roomNumber,
            reason,
            blockedAt: serverTimestamp(),
            blockedUntil: Timestamp.fromDate(blockedUntil),
            failedAttempts: MAX_VERIFICATION_ATTEMPTS
        });

        logger.warn(`Room ${roomNumber} blocked until ${blockedUntil}`, null, 'identityCheckService');
    } catch (error) {
        logger.error('Error blocking room:', error, 'identityCheckService');
        throw error;
    }
}

/**
 * Verify guest phone number (last 4 digits) for QR request
 */
export async function verifyGuestPhone(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    inputPhoneLastFour: string
): Promise<VerificationResult> {
    try {
        // 1. Check if room is blocked
        const blockStatus = await checkRoomBlockStatus(tenantId, branchId, roomNumber);
        if (blockStatus.isBlocked) {
            return {
                success: false,
                isBlocked: true,
                message: `الغرفة محظورة مؤقتاً. يرجى الانتظار ${blockStatus.remainingMinutes} دقيقة أو التواصل مع الاستقبال.`
            };
        }

        // 2. Get the expected phone number
        const guestInfo = await getGuestPhoneLastFour(tenantId, branchId, roomNumber);
        if (!guestInfo) {
            return {
                success: false,
                message: 'لم يتم العثور على بيانات الغرفة. تأكد أن البطاقة مفعلة.'
            };
        }

        // 3. Normalize and compare
        const inputNormalized = inputPhoneLastFour.replace(/\D/g, '').slice(-4);
        const expectedNormalized = guestInfo.phoneLastFour;

        if (inputNormalized === expectedNormalized) {
            // Success!
            logger.info(`Phone verification successful for room ${roomNumber}`, null, 'identityCheckService');
            
            // Clear any previous failed attempts
            const blockId = `${tenantId}_${branchId}_${roomNumber}`;
            const blockRef = doc(db, ROOM_BLOCKS_COLLECTION, blockId);
            const blockSnap = await getDoc(blockRef);
            if (blockSnap.exists()) {
                await updateDoc(blockRef, { 
                    failedAttempts: 0,
                    lastVerifiedAt: serverTimestamp()
                });
            }

            return {
                success: true,
                message: 'تم التحقق بنجاح!'
            };
        }

        // 4. Failed attempt - track and potentially block
        const blockId = `${tenantId}_${branchId}_${roomNumber}`;
        const blockRef = doc(db, ROOM_BLOCKS_COLLECTION, blockId);
        const blockSnap = await getDoc(blockRef);

        let currentAttempts = 0;
        if (blockSnap.exists()) {
            currentAttempts = blockSnap.data().failedAttempts || 0;
        }

        const newAttempts = currentAttempts + 1;
        const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - newAttempts;

        if (newAttempts >= MAX_VERIFICATION_ATTEMPTS) {
            // Block the room
            await blockRoom(
                tenantId, 
                branchId, 
                roomNumber, 
                `${MAX_VERIFICATION_ATTEMPTS} محاولات تحقق فاشلة`
            );

            // Notify reception of suspicious activity
            await notifyReceptionOfSuspiciousActivity(
                tenantId,
                branchId,
                roomNumber,
                `room_${roomNumber}_phone_verification`,
                MAX_VERIFICATION_ATTEMPTS
            );

            logger.warn(`Room ${roomNumber} blocked after ${MAX_VERIFICATION_ATTEMPTS} failed attempts`, null, 'identityCheckService');

            return {
                success: false,
                isBlocked: true,
                remainingAttempts: 0,
                message: `تم حظر الغرفة لمدة ${BLOCK_DURATION_MINUTES} دقيقة. تواصل مع الاستقبال.`
            };
        }

        // Update failed attempts
        await setDoc(blockRef, {
            tenantId,
            branchId,
            roomNumber,
            failedAttempts: newAttempts,
            lastFailedAt: serverTimestamp()
        }, { merge: true });

        logger.warn(`Failed verification attempt ${newAttempts}/${MAX_VERIFICATION_ATTEMPTS} for room ${roomNumber}`, null, 'identityCheckService');

        return {
            success: false,
            remainingAttempts,
            message: `الرقم غير صحيح. المحاولات المتبقية: ${remainingAttempts}`
        };
    } catch (error) {
        logger.error('Error verifying guest phone:', error, 'identityCheckService');
        return {
            success: false,
            message: 'حدث خطأ أثناء التحقق. حاول مرة أخرى.'
        };
    }
}

// ============================================================
// AUTO-FETCH GUEST INFO FOR RECEPTION
// ============================================================

/**
 * Auto-fetch guest name and phone from room card for reception
 */
export async function fetchGuestInfoForReception(
    tenantId: string,
    branchId: string,
    roomNumber: string
): Promise<{ guestName: string; guestPhone: string; guestIdentity: string } | null> {
    try {
        const roomCardsRef = collection(db, 'roomCards');
        const q = query(
            roomCardsRef,
            where('tenantId', '==', tenantId),
            where('branch', '==', branchId),
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active')
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return null;
        }

        const roomCard = snapshot.docs[0].data();
        return {
            guestName: roomCard.guestName || '',
            guestPhone: roomCard.guestPhone || '',
            guestIdentity: roomCard.guestIdentity || ''
        };
    } catch (error) {
        logger.error('Error fetching guest info:', error, 'identityCheckService');
        return null;
    }
}

// ============================================================
// WALK-IN ROOMS (TEMPORARY GUEST DATA)
// ============================================================

/**
 * Set temporary guest data for walk-in rooms
 * Used when a room doesn't have a registered guest but needs QR functionality
 */
export async function setTemporaryGuestData(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    tempGuestName: string,
    tempGuestPhone: string,
    setBy: { id: string; name: string }
): Promise<boolean> {
    try {
        const roomCardsRef = collection(db, 'roomCards');
        const q = query(
            roomCardsRef,
            where('tenantId', '==', tenantId),
            where('branch', '==', branchId),
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active')
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            logger.warn(`No active room card found for room ${roomNumber}`, null, 'identityCheckService');
            return false;
        }

        const roomCardRef = snapshot.docs[0].ref;
        await updateDoc(roomCardRef, {
            guestName: tempGuestName,
            guestPhone: tempGuestPhone,
            isWalkIn: true,
            walkInSetBy: setBy,
            walkInSetAt: serverTimestamp()
        });

        logger.info(`Temporary guest data set for room ${roomNumber}`, null, 'identityCheckService');
        return true;
    } catch (error) {
        logger.error('Error setting temporary guest data:', error, 'identityCheckService');
        return false;
    }
}

// ============================================================
// VERIFICATION HISTORY
// ============================================================

/**
 * Get verification history for a room
 */
export async function getVerificationHistory(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    limit: number = 10
): Promise<IdentityVerification[]> {
    try {
        const verificationsRef = collection(db, VERIFICATION_COLLECTION);
        const q = query(
            verificationsRef,
            where('tenantId', '==', tenantId),
            where('branchId', '==', branchId),
            where('roomNumber', '==', roomNumber)
        );

        const snapshot = await getDocs(q);
        const verifications = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as IdentityVerification))
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
            .slice(0, limit);

        return verifications;
    } catch (error) {
        logger.error('Error getting verification history:', error, 'identityCheckService');
        return [];
    }
}

/**
 * Clear room block (admin function)
 */
export async function clearRoomBlock(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    clearedBy: { id: string; name: string }
): Promise<boolean> {
    try {
        const blockId = `${tenantId}_${branchId}_${roomNumber}`;
        const blockRef = doc(db, ROOM_BLOCKS_COLLECTION, blockId);
        
        await updateDoc(blockRef, {
            failedAttempts: 0,
            blockedUntil: null,
            clearedBy,
            clearedAt: serverTimestamp()
        });

        logger.info(`Room block cleared for ${roomNumber} by ${clearedBy.name}`, null, 'identityCheckService');
        return true;
    } catch (error) {
        logger.error('Error clearing room block:', error, 'identityCheckService');
        return false;
    }
}
