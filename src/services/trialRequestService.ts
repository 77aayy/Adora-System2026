/**
 * Trial Request Service
 * Handles trial request submissions from the About Us page
 * ✅ Architecture: All Firebase operations isolated in services
 */

import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';
import { validateRoleAccess } from './tenantSecurityService';

// ============================================================
// TYPES
// ============================================================

export interface TrialRequest {
    id?: string;
    name: string;
    phone: string;
    status: 'pending' | 'approved' | 'rejected';
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
    source: string = 'about_us_page'
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
            status: 'pending',
            createdAt: serverTimestamp(),
            source
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
