/**
 * Custom Claims Service
 * Frontend service to call Cloud Functions for setting user permissions
 * 
 * هذا الـ Service بيتكلم مع الـ Cloud Function عشان يختم المستخدمين
 * بالـ tenantId والـ role اللي الـ Security Rules بتقرأهم
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from './firebase';
import { logger } from './loggerService';

// Types
export interface SetClaimsParams {
    uid: string;
    tenantId: string;
    role: 'owner' | 'manager' | 'employee' | 'super_admin';
    branchId?: string;
    department?: string;
}

export interface ClaimsResponse {
    success: boolean;
    message: string;
    claims?: Record<string, unknown>;
}

// Initialize Functions
let functions: ReturnType<typeof getFunctions> | null = null;

const getFirebaseFunctions = () => {
    if (!functions && app) {
        functions = getFunctions(app, 'us-central1');
        
        // Connect to emulator in development
        if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
            connectFunctionsEmulator(functions, 'localhost', 5001);
            logger.info('[CustomClaims] Connected to Functions emulator', null, 'customClaimsService');
        }
    }
    return functions;
};

/**
 * Set Custom Claims for a User
 * Call this after creating a new user (manager or employee)
 * 
 * @example
 * // After creating a new employee
 * await setUserClaims({
 *   uid: newUser.uid,
 *   tenantId: currentTenantId,
 *   role: 'employee',
 *   department: 'housekeeping'
 * });
 */
export const setUserClaims = async (params: SetClaimsParams): Promise<ClaimsResponse> => {
    const funcs = getFirebaseFunctions();
    
    if (!funcs) {
        logger.warn('[CustomClaims] Firebase Functions not initialized', null, 'customClaimsService');
        return {
            success: false,
            message: 'Firebase Functions غير مهيأ'
        };
    }

    try {
        const setClaimsFunction = httpsCallable<SetClaimsParams, ClaimsResponse>(
            funcs, 
            'setUserCustomClaims'
        );
        
        const result = await setClaimsFunction(params);
        
        logger.info(`[CustomClaims] Claims set for user ${params.uid}`, result.data, 'customClaimsService');
        
        return result.data;
    } catch (error: any) {
        logger.error('[CustomClaims] Failed to set claims', error, 'customClaimsService');
        
        return {
            success: false,
            message: error.message || 'فشل تحديث الصلاحيات'
        };
    }
};

/**
 * Get User's Current Claims
 * Useful for debugging or displaying user permissions
 */
export const getUserClaims = async (uid: string): Promise<ClaimsResponse> => {
    const funcs = getFirebaseFunctions();
    
    if (!funcs) {
        return {
            success: false,
            message: 'Firebase Functions غير مهيأ'
        };
    }

    try {
        const getClaimsFunction = httpsCallable<{ uid: string }, ClaimsResponse>(
            funcs,
            'getUserCustomClaims'
        );
        
        const result = await getClaimsFunction({ uid });
        return result.data;
    } catch (error: any) {
        logger.error('[CustomClaims] Failed to get claims', error, 'customClaimsService');
        return {
            success: false,
            message: error.message || 'فشل جلب الصلاحيات'
        };
    }
};

/**
 * Revoke User's Claims (Emergency Use)
 * Only Super Admin can call this
 */
export const revokeUserClaims = async (uid: string): Promise<ClaimsResponse> => {
    const funcs = getFirebaseFunctions();
    
    if (!funcs) {
        return {
            success: false,
            message: 'Firebase Functions غير مهيأ'
        };
    }

    try {
        const revokeFunction = httpsCallable<{ uid: string }, ClaimsResponse>(
            funcs,
            'revokeUserClaims'
        );
        
        const result = await revokeFunction({ uid });
        
        logger.warn(`[CustomClaims] Claims revoked for user ${uid}`, null, 'customClaimsService');
        
        return result.data;
    } catch (error: any) {
        logger.error('[CustomClaims] Failed to revoke claims', error, 'customClaimsService');
        return {
            success: false,
            message: error.message || 'فشل سحب الصلاحيات'
        };
    }
};

/**
 * Helper: Set claims after creating a new manager
 */
export const setManagerClaims = async (
    uid: string, 
    tenantId: string
): Promise<ClaimsResponse> => {
    return setUserClaims({
        uid,
        tenantId,
        role: 'manager'
    });
};

/**
 * Helper: Set claims after creating a new employee
 */
export const setEmployeeClaims = async (
    uid: string,
    tenantId: string,
    department: string,
    branchId?: string
): Promise<ClaimsResponse> => {
    return setUserClaims({
        uid,
        tenantId,
        role: 'employee',
        department,
        branchId
    });
};

/**
 * Helper: Force token refresh after setting claims
 * The user needs to get a fresh token to see new claims
 */
export const forceTokenRefresh = async (): Promise<void> => {
    try {
        const { auth } = await import('./firebase');
        if (auth?.currentUser) {
            await auth.currentUser.getIdToken(true);
            logger.info('[CustomClaims] Token refreshed', null, 'customClaimsService');
        }
    } catch (error) {
        logger.error('[CustomClaims] Failed to refresh token', error, 'customClaimsService');
    }
};
