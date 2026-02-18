/**
 * Enhanced Auth Service - Multi-Tenant with Global Codes
 * Adora Hotel Management System V3
 * 
 * @module authService
 * @description
 * This service handles employee authentication using a global unique code system.
 * Each employee has a unique PIN code that maps to their tenant (hotel) and employee record.
 * 
 * ## Hotel Workflow Context:
 * - Employees login using their unique PIN code assigned by the manager
 * - The system looks up the code in `globalCodes` collection to find the tenant
 * - Then loads the employee data from the tenant's isolated employee collection
 * 
 * ## Security Features:
 * - Rate limiting: Max 5 attempts before 15-minute lockout
 * - Session stored in localStorage for persistence
 * - Status check: Suspended employees cannot login
 * - Last login timestamp updated on each successful login
 */

import {
    doc,
    getDoc,
    updateDoc,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Employee } from '../types/tenant';
import { LoginResult } from '../types/auth';
import { logger } from './loggerService';

// ============================================================
// SECURITY CONSTANTS
// ============================================================

/** Maximum failed login attempts before lockout */
const MAX_ATTEMPTS = 5;

/** Lockout duration in milliseconds (15 minutes) */
const LOCKOUT_TIME = 15 * 60 * 1000;

// ============================================================
// RATE LIMITING HELPERS
// ============================================================

/**
 * Retrieves the current failed login attempts from localStorage
 * @private
 * @returns Object containing attempt count and last attempt timestamp
 */
const getAttempts = () => {
    const stored = localStorage.getItem('login_attempts');
    if (!stored) return { count: 0, lastAttempt: 0 };
    return JSON.parse(stored);
};

/**
 * Records a failed login attempt in localStorage
 * @private
 * @returns The new total count of failed attempts
 */
const recordFailure = () => {
    const { count } = getAttempts();
    const newCount = count + 1;
    localStorage.setItem('login_attempts', JSON.stringify({
        count: newCount,
        lastAttempt: Date.now()
    }));
    return newCount;
};

/**
 * Clears all recorded failed login attempts
 * @private
 * @description Called after successful login or lockout expiry
 */
const clearAttempts = () => {
    localStorage.removeItem('login_attempts');
};

// ============================================================
// AUTHENTICATION FUNCTIONS
// ============================================================

/**
 * Authenticates an employee using their global unique code
 * 
 * ## Business Logic:
 * 1. **Rate Limiting**: Check if user exceeded max attempts (5 attempts, 15-min lockout)
 * 2. **Code Lookup**: Find the PIN in `globalCodes` collection (tenant mapping)
 * 3. **Employee Load**: Load employee from tenant's isolated collection
 * 4. **Status Check**: Verify employee is active (not suspended/inactive)
 * 5. **Session Creation**: Store session data and update last login
 * 
 * ## Security Constraints:
 * - ❌ Blocked if rate limit exceeded
 * - ❌ Blocked if employee status !== 'active'
 * - ✅ Clears failed attempts on success
 * 
 * ## Side Effects:
 * - Updates `lastLogin` timestamp in Firestore
 * - Stores session in localStorage: `adora_employee_id`, `adora_tenant_id`, `adora_session`
 * - Records failed attempt on invalid code
 * 
 * @param code - The unique PIN code entered by the employee
 * @returns Promise<LoginResult> - Success with employee data, or failure with error message
 * 
 * @example
 * ```typescript
 * const result = await loginWithGlobalCode('1234');
 * if (result.success) {
 *   // Navigate to employee dashboard
 *   console.log('Welcome', result.employee?.name);
 * } else {
 *   // Show error message
 *   toast.error(result.error);
 * }
 * ```
 */
export async function loginWithGlobalCode(code: string): Promise<LoginResult> {
    try {
        // 🛑 Rate Limiting Check
        const { count, lastAttempt } = getAttempts();
        if (count >= MAX_ATTEMPTS) {
            const timePassed = Date.now() - lastAttempt;
            if (timePassed < LOCKOUT_TIME) {
                const remainingMinutes = Math.ceil((LOCKOUT_TIME - timePassed) / 60000);
                return {
                    success: false,
                    error: `تم تجاوز حد المحاولات. يرجى الانتظار ${remainingMinutes} دقيقة.`
                };
            } else {
                clearAttempts(); // Reset after lockout expires
            }
        }

        // 1. Look up global code in globalCodes collection
        const codeDoc = await getDoc(doc(db, 'globalCodes', code));

        if (!codeDoc.exists()) {
            recordFailure();
            return {
                success: false,
                error: 'رمز الدخول غير صحيح'
            };
        }

        const codeData = codeDoc.data();
        const { tenantId, employeeId } = codeData;

        // 2. Load employee from tenant's isolated collection
        const employeeDoc = await getDoc(
            doc(db, `tenants/${tenantId}/employees`, employeeId)
        );

        if (!employeeDoc.exists()) {
            return {
                success: false,
                error: 'الموظف غير موجود'
            };
        }

        const employee = {
            id: employeeDoc.id,
            ...employeeDoc.data()
        } as Employee;

        // 3. Check employee status - suspended employees cannot login
        if (employee.status !== 'active') {
            return {
                success: false,
                error: 'الحساب موقوف. تواصل مع المدير'
            };
        }

        // 4. Update last login timestamp for audit trail
        await updateDoc(employeeDoc.ref, {
            lastLogin: Timestamp.now()
        });

        // 5. Store session data in localStorage for persistence
        localStorage.setItem('adora_employee_id', employee.id);
        localStorage.setItem('adora_tenant_id', tenantId);
        localStorage.setItem('adora_session', JSON.stringify({
            employeeId: employee.id,
            tenantId,
            code: employee.code,
            loginAt: Date.now()
        }));

        clearAttempts(); // ✅ Reset attempts on success

        return {
            success: true,
            employee,
            tenantId
        };

    } catch (error) {
        logger.error('Login error:', error, 'authService');
        return {
            success: false,
            error: 'حدث خطأ في تسجيل الدخول'
        };
    }
}

/**
 * Loads and validates the current user session from localStorage
 * 
 * ## Business Logic:
 * 1. **Session Check**: Look for existing session in localStorage
 * 2. **Employee Validation**: Verify employee still exists and is active
 * 3. **Status Check**: Return failure if employee is suspended
 * 
 * ## Use Cases:
 * - App initialization: Check if user is already logged in
 * - Session restoration: Reconnect after page refresh
 * - Auth guard: Validate user before accessing protected routes
 * 
 * ## Security Constraints:
 * - ❌ Returns failure if no session exists
 * - ❌ Returns failure if employee was deleted from database
 * - ❌ Returns failure if employee status changed to suspended
 * 
 * @returns Promise<LoginResult> - Success with employee data, or failure with error
 * 
 * @example
 * ```typescript
 * // In AuthContext initialization
 * const session = await loadSession();
 * if (session.success) {
 *   setUser(session.employee);
 *   setTenantId(session.tenantId);
 * } else {
 *   // Redirect to login
 *   navigate('/login');
 * }
 * ```
 */
export async function loadSession(): Promise<LoginResult> {
    try {
        const sessionData = localStorage.getItem('adora_session');
        if (!sessionData) {
            return { success: false, error: 'No session' };
        }

        const session = JSON.parse(sessionData);
        const { tenantId, employeeId } = session;

        // Load employee from their tenant's collection
        const employeeDoc = await getDoc(
            doc(db, `tenants/${tenantId}/employees`, employeeId)
        );

        if (!employeeDoc.exists()) {
            return { success: false, error: 'Employee not found' };
        }

        const employee = {
            id: employeeDoc.id,
            ...employeeDoc.data()
        } as Employee;

        // Verify employee is still active
        if (employee.status !== 'active') {
            return { success: false, error: 'Account suspended' };
        }

        return {
            success: true,
            employee,
            tenantId
        };

    } catch (error) {
        logger.error('Session load error:', error, 'authService');
        return { success: false, error: 'Session error' };
    }
}

/**
 * Logs out the current user by clearing all session data
 * 
 * ## Side Effects:
 * - Removes `adora_employee_id` from localStorage
 * - Removes `adora_tenant_id` from localStorage
 * - Removes `adora_session` from localStorage
 * 
 * ## Note:
 * This function does NOT clear:
 * - Branch ID (user preference)
 * - Theme settings
 * - Other user preferences
 * 
 * @example
 * ```typescript
 * // In logout button handler
 * logout();
 * navigate('/login');
 * toast.success('تم تسجيل الخروج بنجاح');
 * ```
 */
export function logout(): void {
    localStorage.removeItem('adora_employee_id');
    localStorage.removeItem('adora_tenant_id');
    localStorage.removeItem('adora_session');
}
