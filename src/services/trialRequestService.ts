/**
 * Trial Request Service
 * Handles trial request submissions from the About Us page
 * ✅ Architecture: All Firebase operations isolated in services
 */

import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, Timestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { logger } from './loggerService';
import { validateRoleAccess } from './tenantSecurityService';

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

        logger.info('Trial requests fetched successfully', { count: requests.length }, 'trialRequestService');
        
        return { success: true, data: requests };
    } catch (error: any) {
        // ✅ Better error handling for permission errors
        const isPermissionError = error.code === 'permission-denied' || 
                                  error.message?.includes('permission') || 
                                  error.message?.includes('Permission') ||
                                  error.message?.includes('Missing or insufficient');
        
        if (isPermissionError) {
            const permissionError = 'Missing or insufficient permissions. Please check Firestore Rules for trial_requests collection. Make sure the owner role has read access.';
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

    // ✅ Check if user is authenticated (not Anonymous)
    if (!auth?.currentUser || auth.currentUser.isAnonymous) {
        const error = 'يجب تسجيل الدخول كمالك للنظام. المستخدم الحالي غير مصادق عليه.';
        logger.error('User not authenticated or is Anonymous', null, 'trialRequestService');
        return { success: false, error };
    }

    const userId = auth.currentUser.uid;

    // ✅ Check userBindings for owner role (fallback if custom claims not loaded)
    try {
        const userBindingRef = doc(db, 'userBindings', userId);
        const userBindingDoc = await getDoc(userBindingRef);
        
        if (userBindingDoc.exists()) {
            const userBinding = userBindingDoc.data();
            if (userBinding.role === 'owner') {
                logger.info('Owner role confirmed via userBindings', { userId }, 'trialRequestService');
            } else {
                logger.warn('User does not have owner role in userBindings', { userId, role: userBinding.role }, 'trialRequestService');
                // Continue anyway - Firestore Rules will enforce
            }
        } else {
            logger.warn('No userBinding found for user', { userId }, 'trialRequestService');
            // Continue anyway - Firestore Rules will enforce
        }
    } catch (bindingError: any) {
        logger.warn('Failed to check userBindings, proceeding anyway', bindingError, 'trialRequestService');
        // Continue anyway - Firestore Rules will enforce
    }

    // ✅ Optional: Try client-side RBAC check (soft check)
    try {
        validateRoleAccess('owner');
    } catch (rbacError: any) {
        logger.warn('Client-side RBAC check failed, but proceeding to Firestore', rbacError, 'trialRequestService');
    }

    try {
        // ✅ Validate required fields
        if (!contactNotes || !contactNotes.trim()) {
            return { success: false, error: 'الملاحظات مطلوبة' };
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

    try {
        validateRoleAccess('owner');
    } catch (rbacError: any) {
        logger.warn('Client-side RBAC check failed, but proceeding to Firestore', rbacError, 'trialRequestService');
    }

    try {
        // ✅ Validate required fields
        if (!followUpNote || !followUpNote.trim()) {
            return { success: false, error: 'ملاحظة المتابعة مطلوبة' };
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
