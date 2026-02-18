/**
 * Trial Request Service
 * Handles trial request submissions from the About Us page
 * ✅ Architecture: All Firebase operations isolated in services
 */

import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, Timestamp, updateDoc, doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { logger } from './loggerService';
import { validateRoleAccess, isCurrentUserOwner, getCurrentUserRole } from './tenantSecurityService';
import { saveUserBinding } from './userService';
import { getIdToken } from 'firebase/auth';

// ============================================================
// TYPES
// ============================================================

export interface FollowUp {
    note: string; // ملاحظة المتابعة
    createdAt: any; // Firestore serverTimestamp
}

export interface TrialRequest {
    id?: string;
    name: string;
    phone: string;
    requiredBranches?: number; // عدد التراخيص المطلوبة (كل فرع = ترخيص واحد)
    contactedAt?: any; // تاريخ التواصل مع المشترك (Firestore Timestamp)
    contactNotes?: string; // ملاحظات نتيجة الاتصال (طلب ديمو، طلب مهلة تفكير، إلخ) - REQUIRED
    contactResult?: 'demo' | 'thinking' | 'wrong' | 'other'; // نوع الطلب
    followUps?: FollowUp[]; // ملاحظات المتابعة
    createdAt: any; // Firestore serverTimestamp
    source: string;
}

/** طلب محذوف (سجل المحذوفات) */
export interface DeletedTrialRequest extends TrialRequest {
    deletedAt: any; // Firestore Timestamp
    originalId?: string; // id في trial_requests قبل الحذف
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Submit a trial request
 * ✅ Null Safety: Checks db before operations
 * ✅ Error Handling: Wrapped in try-catch with proper logging
 */
export const submitTrialRequest = async (
    name: string,
    phone: string,
    source: string = 'about_us_page',
    requiredBranches?: number
): Promise<{ success: boolean; error?: string }> => {
    // Null safety check
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Trial request submission failed', new Error(error), 'trialRequestService');
        return { success: false, error };
    }

    try {
        // Validate inputs
        if (!name || !name.trim()) {
            return { success: false, error: 'Name is required' };
        }

        if (!phone || !phone.trim()) {
            return { success: false, error: 'Phone is required' };
        }

        // Clean phone number (remove non-digits, keep + if present)
        const cleanPhone = phone.replace(/[^\d+]/g, '');

        if (cleanPhone.length < 10) {
            return { success: false, error: 'Invalid phone number' };
        }

        // Submit to Firestore
        await addDoc(collection(db, 'trial_requests'), {
            name: name.trim(),
            phone: cleanPhone,
            createdAt: serverTimestamp(),
            source,
            requiredBranches: requiredBranches || undefined // عدد التراخيص المطلوبة
        } as Omit<TrialRequest, 'createdAt'> & { createdAt: any });

        logger.info('Trial request submitted successfully', { name, phone: cleanPhone, source }, 'trialRequestService');

        return { success: true };
    } catch (error: any) {
        logger.error('Error submitting trial request', error, 'trialRequestService');
        return { success: false, error: error.message || 'Failed to submit trial request' };
    }
};

/**
 * Get all trial requests
 * ✅ RBAC: Only Owner can access all trial requests
 * ✅ Null Safety: Checks db before operations
 * ✅ Error Handling: Wrapped in try-catch with proper logging
 */
export const getAllTrialRequests = async (): Promise<{ success: boolean; data?: TrialRequest[]; error?: string }> => {
    // Null safety check
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Failed to get trial requests', new Error(error), 'trialRequestService');
        return { success: false, error };
    }

    // ✅ CRITICAL: Wait for Auth token to be ready before making Firestore requests
    // This ensures request.auth is not null in Firestore Rules
    if (auth?.currentUser) {
        try {
            // Force token refresh to ensure it's propagated to Firestore Rules
            await getIdToken(auth.currentUser, true);
            // Wait a brief moment for token to propagate to Firestore Rules
            await new Promise(resolve => setTimeout(resolve, 500));
            logger.debug('Auth token refreshed before reading trial_requests', null, 'trialRequestService');
        } catch (tokenError: any) {
            logger.warn('Failed to refresh auth token, proceeding anyway', tokenError, 'trialRequestService');
        }
    }

    // ✅ RBAC: Check if user is owner (soft check - don't block if role not loaded yet)
    // Note: Firestore Rules will also enforce this, but we check client-side for better UX
    try {
        validateRoleAccess('owner');
    } catch (rbacError: any) {
        // Don't block here - let Firestore Rules handle it for better error messages
        logger.warn('Client-side RBAC check failed, but proceeding to Firestore (Rules will enforce)', rbacError, 'trialRequestService');
    }

    try {
        const q = query(
            collection(db, 'trial_requests'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const requests: TrialRequest[] = [];
        
        querySnapshot.forEach((doc) => {
            requests.push({
                id: doc.id,
                ...doc.data()
            } as TrialRequest);
        });

        logger.debug('Trial requests fetched successfully', { count: requests.length }, 'trialRequestService');
        
        return { success: true, data: requests };
    } catch (error: any) {
        const isChannelError = error?.code === 400 || error?.code === 404 ||
            error?.message?.includes('400') || error?.message?.includes('Listen/channel') || error?.message?.includes('Write/channel');
        if (isChannelError) {
            logger.debug('Trial requests: channel error, returning empty list', undefined, 'trialRequestService');
            return { success: true, data: [] };
        }
        // ✅ Better error handling for permission errors with retry mechanism
        const isPermissionError = error.code === 'permission-denied' || 
                                  error.message?.includes('permission') || 
                                  error.message?.includes('Permission') ||
                                  error.message?.includes('Missing or insufficient');

        if (isPermissionError) {
            // ✅ CRITICAL FIX: Retry once with fresh token if permission denied
            if (auth?.currentUser) {
                try {
                    logger.warn('Permission denied, retrying with fresh token...', null, 'trialRequestService');
                    // Force token refresh and wait longer
                    await getIdToken(auth.currentUser, true);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Retry the query (use same db — safeDb was undefined in this scope)
                    const retryQuery = query(
                        collection(db, 'trial_requests'),
                        orderBy('createdAt', 'desc')
                    );
                    const retrySnapshot = await getDocs(retryQuery);
                    const retryRequests: TrialRequest[] = [];
                    
                    retrySnapshot.forEach((doc) => {
                        retryRequests.push({
                            id: doc.id,
                            ...doc.data()
                        } as TrialRequest);
                    });

                    logger.debug('Trial requests fetched successfully after retry', { count: retryRequests.length }, 'trialRequestService');
                    return { success: true, data: retryRequests };
                } catch (retryError: any) {
                    logger.error('Retry also failed with permission error', retryError, 'trialRequestService');
                }
            }
            
            const permissionError = 'خطأ في الصلاحيات: يرجى التأكد من أنك مسجل دخول كمالك للنظام. إذا استمرت المشكلة، قد تحتاج إلى تحديث Firestore Rules للسماح للمالك بقراءة collection "trial_requests".';
            logger.error('Permission denied for trial requests', error, 'trialRequestService');
            return { success: false, error: permissionError };
        }
        logger.error('Error getting trial requests', error, 'trialRequestService');
        return { success: false, error: error.message || 'Failed to get trial requests' };
    }
};

/**
 * Mark trial request as contacted
 * ✅ Updates contactedAt timestamp when owner contacts the potential subscriber
 * @param requestId - ID of the trial request
 * @param contactResult - Type of contact result (demo, thinking, wrong, other)
 * @param contactNotes - Additional notes about the contact
 */
export const markTrialRequestAsContacted = async (
    requestId: string,
    contactResult?: 'demo' | 'thinking' | 'wrong' | 'other',
    contactNotes: string = '' // ✅ REQUIRED - No longer optional
): Promise<{ success: boolean; error?: string }> => {
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Failed to mark trial request as contacted', new Error(error), 'trialRequestService');
        return { success: false, error };
    }

    // ✅ FIX: Check owner role using multiple methods (localStorage + auth + userBindings)
    // Method 1: Check localStorage first (fastest and most reliable)
    const isOwner = isCurrentUserOwner();
    const userRole = getCurrentUserRole();
    
    if (!isOwner && userRole !== 'owner') {
        // Method 2: Try auth.currentUser if available
        if (auth?.currentUser && !auth.currentUser.isAnonymous) {
            const userId = auth.currentUser.uid;
            
            // Method 3: Check userBindings as fallback
            try {
                const userBindingRef = doc(db, 'userBindings', userId);
                const userBindingDoc = await getDoc(userBindingRef);
                
                if (userBindingDoc.exists()) {
                    const userBinding = userBindingDoc.data();
                    if (userBinding.role === 'owner') {
                        logger.info('Owner role confirmed via userBindings', { userId }, 'trialRequestService');
                    } else {
                        const error = 'يجب تسجيل الدخول كمالك للنظام. المستخدم الحالي غير مصادق عليه.';
                        logger.error('User does not have owner role', { userId, role: userBinding.role }, 'trialRequestService');
                        return { success: false, error };
                    }
                } else {
                    // No userBinding found - check if user is authenticated
                    if (!auth.currentUser || auth.currentUser.isAnonymous) {
                        const error = 'يجب تسجيل الدخول كمالك للنظام. المستخدم الحالي غير مصادق عليه.';
                        logger.error('User not authenticated or is Anonymous', null, 'trialRequestService');
                        return { success: false, error };
                    }
                    // Continue - Firestore Rules will enforce
                    logger.warn('No userBinding found, proceeding with Firestore Rules enforcement', { userId }, 'trialRequestService');
                }
            } catch (bindingError: any) {
                logger.warn('Failed to check userBindings, proceeding anyway', bindingError, 'trialRequestService');
                // Continue - Firestore Rules will enforce
            }
        } else {
            // No auth.currentUser or is Anonymous
            const error = 'يجب تسجيل الدخول كمالك للنظام. المستخدم الحالي غير مصادق عليه.';
            logger.error('User not authenticated or is Anonymous', null, 'trialRequestService');
            return { success: false, error };
        }
    } else {
        // Owner confirmed via localStorage
        logger.info('Owner role confirmed via localStorage', { role: userRole }, 'trialRequestService');
    }

    // ✅ Optional: Try client-side RBAC check (soft check - already confirmed above)
    try {
        validateRoleAccess('owner');
    } catch (rbacError: any) {
        // If we already confirmed owner via localStorage, this is just a warning
        if (isOwner) {
            logger.warn('Client-side RBAC check failed but owner confirmed via localStorage, proceeding', rbacError, 'trialRequestService');
        } else {
            logger.warn('Client-side RBAC check failed, but proceeding to Firestore', rbacError, 'trialRequestService');
        }
    }
    
    // Get userId for logging (use auth.currentUser if available, otherwise from localStorage)
    const userId = auth?.currentUser?.uid || (typeof window !== 'undefined' ? (() => {
        try {
            const storedUser = localStorage.getItem('adora_user');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                return user.uid || user.id || null;
            }
        } catch (e) {
            // Ignore
        }
        return null;
    })() : null);

    try {
        // ✅ Validate required fields
        if (!contactNotes || !contactNotes.trim()) {
            return { success: false, error: 'الملاحظات مطلوبة' };
        }

        // ✅ Refresh token so Firestore rules see latest custom claims (role: 'owner')
        if (auth?.currentUser) {
            await getIdToken(auth.currentUser, true);
        }
        const requestRef = doc(db, 'trial_requests', requestId);
        await updateDoc(requestRef, {
            contactedAt: serverTimestamp(),
            contactResult: contactResult || null,
            contactNotes: contactNotes.trim()
        });

        logger.info('Trial request marked as contacted', { requestId, contactResult, hasNotes: !!contactNotes }, 'trialRequestService');
        return { success: true };
    } catch (error: any) {
        // ✅ Better error handling for permission errors
        const isPermissionError = error.code === 'permission-denied' || 
                                  error.message?.includes('permission') || 
                                  error.message?.includes('Permission') ||
                                  error.message?.includes('Missing or insufficient');
        
        if (isPermissionError) {
            const permissionError = 'خطأ في الصلاحيات: يرجى التأكد من أنك مسجل دخول كمالك للنظام. إذا استمرت المشكلة، قد تحتاج إلى تحديث Firestore Rules للسماح للمالك بتحديث collection "trial_requests".';
            logger.error('Permission denied for marking trial request as contacted', error, 'trialRequestService');
            return { success: false, error: permissionError };
        }
        
        logger.error('Error marking trial request as contacted', error, 'trialRequestService');
        return { success: false, error: error.message || 'فشل حفظ نتيجة الاتصال' };
    }
};

/**
 * Add follow-up note to a contacted trial request
 * ✅ Adds a follow-up entry to the followUps array
 * @param requestId - ID of the trial request
 * @param followUpNote - The follow-up note text
 */
export const addFollowUpToTrialRequest = async (
    requestId: string,
    followUpNote: string
): Promise<{ success: boolean; error?: string }> => {
    if (!db) {
        const error = 'Database not initialized';
        logger.error('Failed to add follow-up', new Error(error), 'trialRequestService');
        return { success: false, error };
    }

    // ✅ FIX: Check owner role using multiple methods (same as markTrialRequestAsContacted)
    const isOwner = isCurrentUserOwner();
    const userRole = getCurrentUserRole();
    
    if (!isOwner && userRole !== 'owner') {
        // Try auth.currentUser if available
        if (auth?.currentUser && !auth.currentUser.isAnonymous) {
            // Check userBindings as fallback
            try {
                const userId = auth.currentUser.uid;
                const userBindingRef = doc(db, 'userBindings', userId);
                const userBindingDoc = await getDoc(userBindingRef);
                
                if (userBindingDoc.exists()) {
                    const userBinding = userBindingDoc.data();
                    if (userBinding.role !== 'owner') {
                        const error = 'يجب تسجيل الدخول كمالك للنظام. المستخدم الحالي غير مصادق عليه.';
                        logger.error('User does not have owner role', { userId, role: userBinding.role }, 'trialRequestService');
                        return { success: false, error };
                    }
                } else {
                    // No userBinding found - check if user is authenticated
                    if (!auth.currentUser || auth.currentUser.isAnonymous) {
                        const error = 'يجب تسجيل الدخول كمالك للنظام. المستخدم الحالي غير مصادق عليه.';
                        logger.error('User not authenticated or is Anonymous', null, 'trialRequestService');
                        return { success: false, error };
                    }
                    // Continue - Firestore Rules will enforce
                    logger.warn('No userBinding found, proceeding with Firestore Rules enforcement', { userId }, 'trialRequestService');
                }
            } catch (bindingError: any) {
                logger.warn('Failed to check userBindings, proceeding anyway', bindingError, 'trialRequestService');
                // Continue - Firestore Rules will enforce
            }
        } else {
            // No auth.currentUser or is Anonymous
            const error = 'يجب تسجيل الدخول كمالك للنظام. المستخدم الحالي غير مصادق عليه.';
            logger.error('User not authenticated or is Anonymous', null, 'trialRequestService');
            return { success: false, error };
        }
    } else {
        // Owner confirmed via localStorage
        logger.info('Owner role confirmed via localStorage', { role: userRole }, 'trialRequestService');
    }

    // ✅ Optional: Try client-side RBAC check (soft check - already confirmed above)
    try {
        validateRoleAccess('owner');
    } catch (rbacError: any) {
        // If we already confirmed owner via localStorage, this is just a warning
        if (isOwner) {
            logger.warn('Client-side RBAC check failed but owner confirmed via localStorage, proceeding', rbacError, 'trialRequestService');
        } else {
            logger.warn('Client-side RBAC check failed, but proceeding to Firestore', rbacError, 'trialRequestService');
        }
    }

    try {
        // ✅ Validate required fields
        if (!followUpNote || !followUpNote.trim()) {
            return { success: false, error: 'ملاحظة المتابعة مطلوبة' };
        }

        // ✅ Refresh token so Firestore rules see latest custom claims (role: 'owner')
        if (auth?.currentUser) {
            await getIdToken(auth.currentUser, true);
        }
        const requestRef = doc(db, 'trial_requests', requestId);
        
        // Get current request to append to existing followUps array
        const requestDoc = await getDoc(requestRef);
        if (!requestDoc.exists()) {
            return { success: false, error: 'الطلب غير موجود' };
        }

        const currentData = requestDoc.data();
        const currentFollowUps = currentData.followUps || [];
        
        // ✅ FIX: serverTimestamp() cannot be used inside arrays
        // Use Timestamp.now() or plain Date object instead
        const newFollowUps = [
            ...currentFollowUps,
            {
                note: followUpNote.trim(),
                createdAt: Timestamp.now() // ✅ Use Timestamp.now() instead of serverTimestamp()
            }
        ];

        await updateDoc(requestRef, {
            followUps: newFollowUps
        });

        logger.info('Follow-up added to trial request', { requestId, followUpCount: newFollowUps.length }, 'trialRequestService');
        return { success: true };
    } catch (error: any) {
        const isPermissionError = error.code === 'permission-denied' || 
                                  error.message?.includes('permission') || 
                                  error.message?.includes('Permission') ||
                                  error.message?.includes('Missing or insufficient');
        
        if (isPermissionError) {
            const permissionError = 'خطأ في الصلاحيات: يرجى التأكد من أنك مسجل دخول كمالك للنظام.';
            logger.error('Permission denied for adding follow-up', error, 'trialRequestService');
            return { success: false, error: permissionError };
        }
        
        logger.error('Error adding follow-up', error, 'trialRequestService');
        return { success: false, error: error.message || 'فشل إضافة ملاحظة المتابعة' };
    }
};

/**
 * Delete a trial request (owner only).
 * Archives the request to trial_requests_deleted before deleting so it appears in "سجل المحذوفات".
 * ✅ FIX: Token refresh + delay so Firestore Rules see owner; retry once after ensuring userBindings.
 */
export const deleteTrialRequest = async (requestId: string): Promise<{ success: boolean; error?: string }> => {
    if (!db) {
        return { success: false, error: 'Database not initialized' };
    }
    try {
        validateRoleAccess('owner');
    } catch {
        return { success: false, error: 'صلاحية المالك مطلوبة لحذف الطلب' };
    }

    const runDelete = async (): Promise<void> => {
        const requestRef = doc(db!, 'trial_requests', requestId);
        const requestDoc = await getDoc(requestRef);
        if (!requestDoc.exists()) {
            throw new Error('الطلب غير موجود');
        }
        const data = requestDoc.data();
        await addDoc(collection(db!, 'trial_requests_deleted'), {
            ...data,
            originalId: requestId,
            deletedAt: serverTimestamp(),
        });
        await deleteDoc(requestRef);
    };

    const permissionErrorMsg = 'خطأ في الصلاحيات. تأكد من تسجيل الدخول كمالك. إذا كنت مالكاً، جرّب تسجيل الخروج ثم الدخول مرة أخرى أو زر "مزامنة الأمان".';

    // ✅ نفس منطق زر "مزامنة الأمان" — قبل أي محاولة حذف
    const uid = auth?.currentUser?.uid;
    if (uid) {
        const stored = localStorage.getItem('adora_user');
        const user = stored ? JSON.parse(stored) : null;
        if (user?.role === 'owner') {
            try {
                await saveUserBinding(uid, user.tenantId || 'system-owner', 'owner');
                logger.debug('Owner userBindings synced before delete (like مزامنة الأمان)', { uid }, 'trialRequestService');
            } catch (bindErr: any) {
                logger.warn('saveUserBinding before delete failed', bindErr?.message, 'trialRequestService');
                try {
                    const bindingRef = doc(db, 'userBindings', uid);
                    await setDoc(bindingRef, {
                        uid,
                        tenantId: user.tenantId || 'system-owner',
                        role: 'owner',
                        updatedAt: serverTimestamp(),
                    }, { merge: true });
                } catch (e2: any) {
                    logger.warn('setDoc userBindings fallback failed', e2?.message, 'trialRequestService');
                }
            }
            await getIdToken(auth.currentUser!, true);
            await new Promise(resolve => setTimeout(resolve, 1200));
        } else {
            await getIdToken(auth.currentUser!, true);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    try {
        await runDelete();
        logger.info('Trial request deleted and archived', { requestId }, 'trialRequestService');
        return { success: true };
    } catch (err: any) {
        const isPermissionError = err?.code === 'permission-denied' || err?.message?.includes('permission') || err?.message?.includes('Missing or insufficient');
        if (isPermissionError && auth?.currentUser) {
            try {
                const stored = localStorage.getItem('adora_user');
                const user = stored ? JSON.parse(stored) : null;
                if (user?.role === 'owner') {
                    await saveUserBinding(auth.currentUser!.uid, user.tenantId || 'system-owner', 'owner');
                    await getIdToken(auth.currentUser!, true);
                    await new Promise(resolve => setTimeout(resolve, 1200));
                    await runDelete();
                    logger.info('Trial request deleted after userBinding sync + retry', { requestId }, 'trialRequestService');
                    return { success: true };
                }
            } catch (retryErr: any) {
                logger.warn('Delete retry after userBinding sync failed', retryErr, 'trialRequestService');
            }
            return { success: false, error: permissionErrorMsg };
        }
        if (isPermissionError) {
            return { success: false, error: permissionErrorMsg };
        }
        if (err?.message === 'الطلب غير موجود') {
            return { success: false, error: err.message };
        }
        logger.error('Error deleting trial request', err, 'trialRequestService');
        return { success: false, error: err?.message || 'فشل حذف الطلب' };
    }
};

/**
 * Get all deleted trial requests (سجل المحذوفات) - owner only.
 * ✅ Same token refresh + retry as getAllTrialRequests so Firestore Rules see owner.
 */
export const getDeletedTrialRequests = async (): Promise<{ success: boolean; data?: DeletedTrialRequest[]; error?: string }> => {
    if (!db) {
        return { success: false, error: 'Database not initialized' };
    }
    if (auth?.currentUser) {
        try {
            await getIdToken(auth.currentUser, true);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (tokenError: any) {
            logger.warn('Failed to refresh auth token before deleted requests', tokenError, 'trialRequestService');
        }
    }
    try {
        validateRoleAccess('owner');
    } catch {
        logger.warn('Client-side RBAC check failed for deleted requests, proceeding', null, 'trialRequestService');
    }
    const runQuery = async () => {
        const q = query(
            collection(db, 'trial_requests_deleted'),
            orderBy('deletedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const list: DeletedTrialRequest[] = [];
        snapshot.forEach((d) => {
            list.push({
                id: d.id,
                originalId: d.data().originalId,
                deletedAt: d.data().deletedAt,
                ...d.data(),
            } as DeletedTrialRequest);
        });
        return list;
    };
    try {
        const list = await runQuery();
        return { success: true, data: list };
    } catch (err: any) {
        const isPermissionError = err?.code === 'permission-denied' || err?.message?.includes('permission') || err?.message?.includes('Missing or insufficient');
        if (isPermissionError && auth?.currentUser) {
            try {
                await getIdToken(auth.currentUser, true);
                await new Promise(resolve => setTimeout(resolve, 1000));
                const list = await runQuery();
                return { success: true, data: list };
            } catch (retryErr: any) {
                return { success: false, error: 'خطأ في الصلاحيات. يرجى تسجيل الدخول كمالك.' };
            }
        }
        if (isPermissionError) {
            return { success: false, error: 'خطأ في الصلاحيات. يرجى تسجيل الدخول كمالك.' };
        }
        logger.error('Error getting deleted trial requests', err, 'trialRequestService');
        return { success: false, error: err?.message || 'فشل جلب سجل المحذوفات' };
    }
};
