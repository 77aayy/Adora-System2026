/**
 * Anonymous Authentication Service
 * Adora Hotel Management System V3
 * 
 * 🔐 SECURITY: Guest Identity Management
 * - Provides temporary anonymous identity for QR code users
 * - Enables rate limiting and quota protection
 * - Prevents unauthorized access to Firebase resources
 * 
 * 💰 BUDGET PROTECTION:
 * - Without anonymous auth, anyone with API key can make unlimited reads
 * - With anonymous auth, we can track and limit requests per device
 */

import { 
    signInAnonymously, 
    signOut,
    onAuthStateChanged,
    User
} from 'firebase/auth';
import { auth, db, isFirebaseConfigured } from './firebase';
import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    increment, 
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { logger } from './loggerService';
import { generateDeviceFingerprint, getSavedDeviceFingerprint, saveDeviceFingerprint } from './locationService';

// ============================================================
// CONSTANTS
// ============================================================

const ANON_USER_STORAGE_KEY = 'adora_anon_uid';
const RATE_LIMIT_COLLECTION = 'guestRateLimits';

// Rate limits per time window
export const RATE_LIMITS = {
    REQUESTS_PER_HOUR: 10,      // Max service requests per hour
    CHATS_PER_HOUR: 50,         // Max chat messages per hour
    READS_PER_MINUTE: 30,       // Max document reads per minute
    API_CALLS_PER_MINUTE: 60    // Max API calls per minute
};

// ============================================================
// TYPES
// ============================================================

export interface GuestRateLimit {
    uid: string;
    deviceFingerprint: string;
    tenantId: string;
    roomNumber: string;
    requestsThisHour: number;
    chatsThisHour: number;
    readsThisMinute: number;
    lastRequestAt: Date | null;
    lastChatAt: Date | null;
    lastReadAt: Date | null;
    hourlyResetAt: Date;
    minuteResetAt: Date;
    totalRequests: number;
    isBlocked: boolean;
    blockedReason?: string;
    blockedUntil?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface RateLimitCheckResult {
    allowed: boolean;
    reason?: string;
    remainingRequests?: number;
    resetIn?: number; // seconds
}

// ============================================================
// ANONYMOUS AUTHENTICATION
// ============================================================

/**
 * Get or create anonymous user for guest access
 * This provides a temporary identity for QR code users
 */
export const ensureAnonymousAuth = async (): Promise<User | null> => {
    if (!isFirebaseConfigured() || !auth) {
        logger.warn('⚠️ Firebase not configured, cannot create anonymous user', undefined, 'anonymousAuthService');
        return null;
    }

    // Check if already signed in
    if (auth.currentUser) {
        logger.info('✅ Already authenticated:', auth.currentUser.uid, 'anonymousAuthService');
        return auth.currentUser;
    }

    try {
        logger.info('🔐 Creating anonymous session for guest...', undefined, 'anonymousAuthService');
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        
        // Save UID locally for tracking
        localStorage.setItem(ANON_USER_STORAGE_KEY, user.uid);
        
        logger.info('✅ Anonymous auth successful:', user.uid, 'anonymousAuthService');
        return user;
    } catch (error: any) {
        logger.error('❌ Anonymous auth failed:', error, 'anonymousAuthService');
        
        // Handle specific errors
        if (error.code === 'auth/operation-not-allowed') {
            logger.error('⚠️ Anonymous auth not enabled in Firebase Console!', undefined, 'anonymousAuthService');
            logger.error('   Go to: Firebase Console → Authentication → Sign-in method → Anonymous → Enable', undefined, 'anonymousAuthService');
        }
        
        return null;
    }
};

/**
 * Get current anonymous user UID
 */
export const getAnonymousUid = (): string | null => {
    if (auth?.currentUser) {
        return auth.currentUser.uid;
    }
    return localStorage.getItem(ANON_USER_STORAGE_KEY);
};

/**
 * Check if user is anonymously authenticated
 */
export const isAnonymouslyAuthenticated = (): boolean => {
    return auth?.currentUser?.isAnonymous === true;
};

/**
 * Sign out anonymous user (cleanup)
 */
export const signOutAnonymous = async (): Promise<void> => {
    if (!auth) return;
    
    try {
        await signOut(auth);
        localStorage.removeItem(ANON_USER_STORAGE_KEY);
        logger.info('✅ Anonymous session ended', undefined, 'anonymousAuthService');
    } catch (error) {
        logger.error('Error signing out:', error, 'anonymousAuthService');
    }
};

/**
 * Listen for auth state changes
 */
export const onAnonymousAuthChange = (callback: (user: User | null) => void): () => void => {
    if (!auth) {
        callback(null);
        return () => {};
    }
    
    return onAuthStateChanged(auth, (user) => {
        callback(user);
    });
};

// ============================================================
// RATE LIMITING
// ============================================================

/**
 * Initialize rate limit tracking for a guest
 */
export const initializeGuestRateLimit = async (
    tenantId: string,
    roomNumber: string
): Promise<GuestRateLimit | null> => {
    if (!db || !auth?.currentUser) return null;

    const uid = auth.currentUser.uid;
    const fingerprint = getSavedDeviceFingerprint() || generateDeviceFingerprint();
    saveDeviceFingerprint(fingerprint);

    const now = new Date();
    const hourlyReset = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const minuteReset = new Date(now.getTime() + 60 * 1000); // 1 minute from now

    const rateLimitData: GuestRateLimit = {
        uid,
        deviceFingerprint: fingerprint,
        tenantId,
        roomNumber,
        requestsThisHour: 0,
        chatsThisHour: 0,
        readsThisMinute: 0,
        lastRequestAt: null,
        lastChatAt: null,
        lastReadAt: null,
        hourlyResetAt: hourlyReset,
        minuteResetAt: minuteReset,
        totalRequests: 0,
        isBlocked: false,
        createdAt: now,
        updatedAt: now
    };

    try {
        const docRef = doc(db, RATE_LIMIT_COLLECTION, uid);
        await setDoc(docRef, {
            ...rateLimitData,
            hourlyResetAt: Timestamp.fromDate(hourlyReset),
            minuteResetAt: Timestamp.fromDate(minuteReset),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });

        logger.info('✅ Rate limit initialized for guest:', uid, 'anonymousAuthService');
        return rateLimitData;
    } catch (error) {
        logger.error('Error initializing rate limit:', error, 'anonymousAuthService');
        return null;
    }
};

/**
 * Check if a request is allowed under rate limits
 */
export const checkRateLimit = async (
    actionType: 'request' | 'chat' | 'read'
): Promise<RateLimitCheckResult> => {
    if (!db || !auth?.currentUser) {
        return { allowed: false, reason: 'غير مصادق عليه' };
    }

    const uid = auth.currentUser.uid;
    
    try {
        const docRef = doc(db, RATE_LIMIT_COLLECTION, uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // First request - allow it
            return { allowed: true, remainingRequests: RATE_LIMITS.REQUESTS_PER_HOUR - 1 };
        }

        const data = docSnap.data() as any;
        const now = new Date();

        // Check if blocked
        if (data.isBlocked) {
            const blockedUntil = data.blockedUntil?.toDate?.() || data.blockedUntil;
            if (blockedUntil && new Date(blockedUntil) > now) {
                return { 
                    allowed: false, 
                    reason: data.blockedReason || 'تم حظر الجهاز مؤقتاً',
                    resetIn: Math.floor((new Date(blockedUntil).getTime() - now.getTime()) / 1000)
                };
            }
            // Block expired, continue checking
        }

        // Check hourly limits for requests/chats
        const hourlyReset = data.hourlyResetAt?.toDate?.() || new Date(data.hourlyResetAt);
        let requestsThisHour = data.requestsThisHour || 0;
        let chatsThisHour = data.chatsThisHour || 0;

        // Reset hourly counters if needed
        if (now > hourlyReset) {
            requestsThisHour = 0;
            chatsThisHour = 0;
            await updateDoc(docRef, {
                requestsThisHour: 0,
                chatsThisHour: 0,
                hourlyResetAt: Timestamp.fromDate(new Date(now.getTime() + 60 * 60 * 1000))
            });
        }

        // Check minute limits for reads
        const minuteReset = data.minuteResetAt?.toDate?.() || new Date(data.minuteResetAt);
        let readsThisMinute = data.readsThisMinute || 0;

        if (now > minuteReset) {
            readsThisMinute = 0;
            await updateDoc(docRef, {
                readsThisMinute: 0,
                minuteResetAt: Timestamp.fromDate(new Date(now.getTime() + 60 * 1000))
            });
        }

        // Check limits based on action type
        switch (actionType) {
            case 'request':
                if (requestsThisHour >= RATE_LIMITS.REQUESTS_PER_HOUR) {
                    return { 
                        allowed: false, 
                        reason: `تجاوزت الحد الأقصى (${RATE_LIMITS.REQUESTS_PER_HOUR} طلب/ساعة)`,
                        remainingRequests: 0,
                        resetIn: Math.floor((hourlyReset.getTime() - now.getTime()) / 1000)
                    };
                }
                return { 
                    allowed: true, 
                    remainingRequests: RATE_LIMITS.REQUESTS_PER_HOUR - requestsThisHour - 1 
                };

            case 'chat':
                if (chatsThisHour >= RATE_LIMITS.CHATS_PER_HOUR) {
                    return { 
                        allowed: false, 
                        reason: `تجاوزت حد الرسائل (${RATE_LIMITS.CHATS_PER_HOUR} رسالة/ساعة)`,
                        remainingRequests: 0,
                        resetIn: Math.floor((hourlyReset.getTime() - now.getTime()) / 1000)
                    };
                }
                return { allowed: true, remainingRequests: RATE_LIMITS.CHATS_PER_HOUR - chatsThisHour - 1 };

            case 'read':
                if (readsThisMinute >= RATE_LIMITS.READS_PER_MINUTE) {
                    return { 
                        allowed: false, 
                        reason: 'عدد طلبات كثيرة، حاول بعد دقيقة',
                        remainingRequests: 0,
                        resetIn: Math.floor((minuteReset.getTime() - now.getTime()) / 1000)
                    };
                }
                return { allowed: true, remainingRequests: RATE_LIMITS.READS_PER_MINUTE - readsThisMinute - 1 };

            default:
                return { allowed: true };
        }
    } catch (error) {
        logger.error('Error checking rate limit:', error, 'anonymousAuthService');
        // Allow on error (don't block legitimate users)
        return { allowed: true };
    }
};

/**
 * Record an action for rate limiting
 */
export const recordRateLimitedAction = async (
    actionType: 'request' | 'chat' | 'read'
): Promise<void> => {
    if (!db || !auth?.currentUser) return;

    const uid = auth.currentUser.uid;

    try {
        const docRef = doc(db, RATE_LIMIT_COLLECTION, uid);
        
        const updates: Record<string, any> = {
            updatedAt: serverTimestamp()
        };

        switch (actionType) {
            case 'request':
                updates.requestsThisHour = increment(1);
                updates.totalRequests = increment(1);
                updates.lastRequestAt = serverTimestamp();
                break;
            case 'chat':
                updates.chatsThisHour = increment(1);
                updates.lastChatAt = serverTimestamp();
                break;
            case 'read':
                updates.readsThisMinute = increment(1);
                updates.lastReadAt = serverTimestamp();
                break;
        }

        await updateDoc(docRef, updates);
    } catch (error) {
        logger.error('Error recording rate limited action:', error, 'anonymousAuthService');
    }
};

/**
 * Block a guest temporarily (for abuse)
 */
export const blockGuest = async (
    uid: string,
    reason: string,
    durationMinutes: number = 60
): Promise<void> => {
    if (!db) return;

    try {
        const docRef = doc(db, RATE_LIMIT_COLLECTION, uid);
        await updateDoc(docRef, {
            isBlocked: true,
            blockedReason: reason,
            blockedUntil: Timestamp.fromDate(new Date(Date.now() + durationMinutes * 60 * 1000)),
            updatedAt: serverTimestamp()
        });
        logger.info(`⛔ Guest ${uid} blocked for ${durationMinutes} minutes: ${reason}`, undefined, 'anonymousAuthService');
    } catch (error) {
        logger.error('Error blocking guest:', error, 'anonymousAuthService');
    }
};

/**
 * Unblock a guest
 */
export const unblockGuest = async (uid: string): Promise<void> => {
    if (!db) return;

    try {
        const docRef = doc(db, RATE_LIMIT_COLLECTION, uid);
        await updateDoc(docRef, {
            isBlocked: false,
            blockedReason: null,
            blockedUntil: null,
            updatedAt: serverTimestamp()
        });
        logger.info(`✅ Guest ${uid} unblocked`, undefined, 'anonymousAuthService');
    } catch (error) {
        logger.error('Error unblocking guest:', error, 'anonymousAuthService');
    }
};

// ============================================================
// CHECKOUT CLEANUP
// ============================================================

/**
 * Clean up guest rate limit data on checkout
 * Called when a room is checked out to remove guest tracking data
 * 🔐 Privacy: Removes guest data when they leave
 * 💾 Storage: Prevents data accumulation
 */
export const cleanupGuestRateLimitOnCheckout = async (
    tenantId: string,
    roomNumber: string
): Promise<{ success: boolean; deletedCount: number }> => {
    if (!db) {
        return { success: false, deletedCount: 0 };
    }

    try {
        // Import query functions
        const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
        
        // Find all rate limit documents for this room
        const rateLimitsRef = collection(db, RATE_LIMIT_COLLECTION);
        const q = query(
            rateLimitsRef,
            where('tenantId', '==', tenantId),
            where('roomNumber', '==', roomNumber)
        );

        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            logger.info(`ℹ️ No rate limit data found for room ${roomNumber}`, undefined, 'anonymousAuthService');
            return { success: true, deletedCount: 0 };
        }

        // Delete all matching documents
        let deletedCount = 0;
        const deletePromises = snapshot.docs.map(async (docSnapshot) => {
            try {
                await deleteDoc(docSnapshot.ref);
                deletedCount++;
                logger.info(`🗑️ Deleted rate limit for guest UID: ${docSnapshot.id}`, undefined, 'anonymousAuthService');
            } catch (err) {
                logger.warn(`Failed to delete rate limit ${docSnapshot.id}:`, err, 'anonymousAuthService');
            }
        });

        await Promise.all(deletePromises);
        
        logger.info(`✅ Cleaned up ${deletedCount} guest rate limit record(s) for room ${roomNumber}`, undefined, 'anonymousAuthService');
        return { success: true, deletedCount };
    } catch (error) {
        logger.error('Error cleaning up guest rate limits:', error, 'anonymousAuthService');
        return { success: false, deletedCount: 0 };
    }
};

// ============================================================
// HELPER: Check and ensure auth before any guest action
// ============================================================

/**
 * Ensure guest is authenticated and rate limit allows action
 * Call this before any guest-initiated action
 */
export const ensureGuestCanAct = async (
    actionType: 'request' | 'chat' | 'read',
    tenantId?: string,
    roomNumber?: string
): Promise<RateLimitCheckResult & { user: User | null }> => {
    // 1. Ensure anonymous auth
    const user = await ensureAnonymousAuth();
    if (!user) {
        return { 
            allowed: false, 
            reason: 'فشل في إنشاء جلسة. تأكد من تفعيل Anonymous Auth في Firebase.',
            user: null
        };
    }

    // 2. Initialize rate limit if needed
    if (tenantId && roomNumber) {
        await initializeGuestRateLimit(tenantId, roomNumber);
    }

    // 3. Check rate limit
    const rateLimitResult = await checkRateLimit(actionType);
    
    return {
        ...rateLimitResult,
        user
    };
};
