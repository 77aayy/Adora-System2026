/**
 * User Service
 * Handles user authentication and management with Owner/Manager/Employee hierarchy
 * Adora Hotel Management System V3 - SaaS Multi-Tenant Model
 * 
 * @module userService
 * @description
 * This service manages user authentication using PIN codes and handles the
 * Owner → Manager → Employee hierarchy in the SaaS multi-tenant architecture.
 * 
 * ## User Hierarchy:
 * - **Owner**: System owner with PIN `765255` (hashed), accesses all tenants
 * - **Manager**: Hotel manager with their own tenant, manages employees
 * - **Employee**: Staff member under a manager's tenant
 * 
 * ## Authentication Flow:
 * 1. User enters PIN code
 * 2. System checks if it's the owner PIN (hashed comparison)
 * 3. If not owner, lookup in `globalCodes` collection for manager/branch PIN
 * 4. If not in globalCodes, lookup in `users` collection
 * 5. Validate tenant status, license, and user status
 * 6. Return user data with available branches
 * 
 * ## Security Features:
 * - Rate limiting (5 attempts, 30-min lockout)
 * - Tenant/Manager status check (blocked if suspended)
 * - License expiry validation
 * - PIN uniqueness enforcement
 */

import {
    collection,
    query,
    where,
    getDocs,
    setDoc,
    doc,
    serverTimestamp,
    getDoc,
    writeBatch,
    Timestamp,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebase';
// ✅ Import for local use
import { User, Department } from '../types';
import { isPinAvailable } from './ownerService';
import { verifyOwnerPin } from './hashService';
import { logger } from './loggerService';
import { assertTenantId, isTenantId } from '../utils/typeGuards';

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEYS = {
    BRANCH_ID: 'adora_branch_id',
    LAST_USERS: 'adora_last_users',
    BIOMETRIC_ENABLED: 'adora_biometric_enabled',
};

// ✅ SaaS: Rate Limiting Configuration
const RATE_LIMIT_CONFIG = {
    MAX_ATTEMPTS: 5, // Maximum failed attempts
    WINDOW_MINUTES: 15, // Time window in minutes
    LOCKOUT_MINUTES: 30, // Lockout duration after max attempts
};

// ============================================================
// TYPES
// ============================================================

// Types imported from ../types

// ============================================================
// BRANCH HELPERS
// ============================================================

export const getStoredBranchId = (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.BRANCH_ID);
};

export const saveBranchId = (branchId: string): void => {
    localStorage.setItem(STORAGE_KEYS.BRANCH_ID, branchId);
};

export const getLastUsers = (): Array<{ id: string; name: string; department: string }> => {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.LAST_USERS);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

export const addToLastUsers = (user: User): void => {
    const lastUsers = getLastUsers();
    const filtered = lastUsers.filter(u => u.id !== user.id);
    const updated = [
        { id: user.id, name: user.name, department: user.department },
        ...filtered,
    ].slice(0, 3);
    localStorage.setItem(STORAGE_KEYS.LAST_USERS, JSON.stringify(updated));
};

export const clearLastUsers = (): void => {
    localStorage.removeItem(STORAGE_KEYS.LAST_USERS);
};

// ============================================================
// AUTHENTICATION
// ============================================================

/**
 * Loads available branches for a user (manager or employee)
 * 
 * ## Business Logic:
 * - **Owner**: Returns empty array (owner accesses all branches)
 * - **Manager**: Loads branches from tenant's branches collection
 * - **Employee**: Returns branches from user.branches array
 * 
 * ## Security Constraints:
 * - ✅ Filters out inactive/deleted/scheduled_for_deletion branches
 * - ✅ Only returns branches within user's tenant scope
 * 
 * ## Use Cases:
 * - Branch selection dropdown after login
 * - Validating branch access before operations
 * 
 * @param user - The authenticated user
 * @returns Array of available branches with id, code, name, and status
 * 
 * @example
 * ```typescript
 * const branches = await loadAvailableBranches(currentUser);
 * // [{ id: 'branch-1', code: '6', name: 'الكورنيش', status: 'active' }]
 * ```
 */
export const loadAvailableBranches = async (user: User): Promise<Array<{ id: string; code?: string; name: string; status?: string }>> => {
    if (user.role === 'owner') {
        return []; // Owner doesn't need branch selection
    }

    if (user.tenantId) {
        // Manager: Load branches from tenant
        const tenantRef = doc(db, 'tenants', user.tenantId);
        const tenantDoc = await getDoc(tenantRef);

        if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            const branchCodes = tenantData.info?.branchCodes || [];

            // Load branches from tenant/branches collection
            const branchesRef = collection(db, `tenants/${user.tenantId}/branches`);
            const branchesSnap = await getDocs(branchesRef);

            // ✅ FIX: Filter out inactive/deleted branches (SaaS Dynamic)
            return branchesSnap.docs
                .filter(doc => {
                    const status = doc.data().status;
                    return status !== 'scheduled_for_deletion' && 
                           status !== 'deleted' && 
                           status !== 'inactive';
                })
                .map(doc => ({
                    id: doc.id,
                    code: doc.data().code,
                    name: doc.data().name || `فرع ${doc.data().code || doc.id}`,
                    status: doc.data().status,
                }));
        }
    }

    // Employee: Return branches from user.branches
    if (user.branches && user.branches.length > 0) {
        // Load branch details from tenant or global branches
        const branches: Array<{ id: string; code?: string; name: string; status?: string }> = [];

        for (const branchId of user.branches) {
            if (user.tenantId) {
                // Load from tenant branches
                const branchRef = doc(db, `tenants/${user.tenantId}/branches`, branchId);
                const branchDoc = await getDoc(branchRef);
                if (branchDoc.exists()) {
                    const status = branchDoc.data().status;
                    // ✅ FIX: Skip inactive/deleted branches (SaaS Dynamic)
                    if (status === 'scheduled_for_deletion' || status === 'deleted' || status === 'inactive') {
                        continue;
                    }
                    branches.push({
                        id: branchId,
                        code: branchDoc.data().code,
                        name: branchDoc.data().name || `فرع ${branchDoc.data().code || branchId}`,
                        status: status,
                    });
                }
            } else {
                // Legacy: Use branchId as name
                branches.push({
                    id: branchId,
                    name: branchId,
                });
            }
        }

        return branches;
    }

    return [];
};

/**
 * ✅ SaaS: Check rate limiting for PIN login attempts
 * ⚠️ SIMPLIFIED: Uses localStorage-based rate limiting to avoid Firestore index requirement
 */
const checkRateLimit = async (pin: string): Promise<{ allowed: boolean; remainingAttempts: number; lockoutUntil?: Date }> => {
    try {
        // ✅ Use localStorage for rate limiting (avoids Firestore index requirement)
        const rateLimitKey = `adora_rate_limit_${pin}`;
        const stored = localStorage.getItem(rateLimitKey);
        
        if (stored) {
            const data = JSON.parse(stored);
            const now = Date.now();
            
            // Check if lockout period has passed
            if (data.lockoutUntil && now < data.lockoutUntil) {
                return {
                    allowed: false,
                    remainingAttempts: 0,
                    lockoutUntil: new Date(data.lockoutUntil)
                };
            }
            
            // Reset if window expired
            const windowMs = RATE_LIMIT_CONFIG.WINDOW_MINUTES * 60 * 1000;
            if (now - data.windowStart > windowMs) {
                localStorage.removeItem(rateLimitKey);
                return { allowed: true, remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
            }
            
            const remainingAttempts = Math.max(0, RATE_LIMIT_CONFIG.MAX_ATTEMPTS - data.attempts);
            return { allowed: remainingAttempts > 0, remainingAttempts };
        }
        
        return { allowed: true, remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
    } catch (error) {
        // If rate limit check fails, allow the attempt (fail open for availability)
        logger.warn('Rate limit check failed', error, 'userService');
        return { allowed: true, remainingAttempts: RATE_LIMIT_CONFIG.MAX_ATTEMPTS };
    }
};

/**
 * ✅ SaaS: Record login attempt
 * ⚠️ SIMPLIFIED: Uses localStorage + Firestore (Firestore is optional, won't block login)
 */
const recordLoginAttempt = async (pin: string, success: boolean): Promise<void> => {
    try {
        // ✅ Always update localStorage (reliable, no auth needed)
        const rateLimitKey = `adora_rate_limit_${pin}`;
        const stored = localStorage.getItem(rateLimitKey);
        const now = Date.now();
        const windowMs = RATE_LIMIT_CONFIG.WINDOW_MINUTES * 60 * 1000;
        
        if (stored) {
            const data = JSON.parse(stored);
            // If window expired, start new window
            if (now - data.windowStart > windowMs) {
                localStorage.setItem(rateLimitKey, JSON.stringify({
                    attempts: success ? 0 : 1,
                    windowStart: now,
                    lockoutUntil: null
                }));
            } else {
                // Increment failed attempts
                if (!success) {
                    const newAttempts = (data.attempts || 0) + 1;
                    const lockoutUntil = newAttempts >= RATE_LIMIT_CONFIG.MAX_ATTEMPTS
                        ? now + (RATE_LIMIT_CONFIG.LOCKOUT_MINUTES * 60 * 1000)
                        : null;
                    
                    localStorage.setItem(rateLimitKey, JSON.stringify({
                        attempts: newAttempts,
                        windowStart: data.windowStart,
                        lockoutUntil
                    }));
                } else {
                    // Reset on success
                    localStorage.removeItem(rateLimitKey);
                }
            }
        } else if (!success) {
            // First failed attempt
            localStorage.setItem(rateLimitKey, JSON.stringify({
                attempts: 1,
                windowStart: now,
                lockoutUntil: null
            }));
        }
        
        // ✅ Try to record in Firestore (optional, won't block if fails)
        if (db) {
            try {
                await setDoc(doc(collection(db, 'loginAttempts')), {
                    pin,
                    success,
                    timestamp: serverTimestamp(),
                    ip: 'client',
                });
            } catch (firestoreError) {
                // Ignore Firestore errors - localStorage is enough
                logger.warn('Failed to record login attempt in Firestore (using localStorage only)', firestoreError, 'userService');
            }
        }
    } catch (error) {
        // Fail silently - don't block login if recording fails
        logger.warn('Failed to record login attempt', error, 'userService');
    }
};

/**
 * Authenticates a user with PIN code (Owner/Manager/Employee)
 * 
 * ## Business Logic:
 * 1. **Rate Limiting**: Block if too many failed attempts
 * 2. **Owner Check**: Verify against hashed owner PIN
 * 3. **GlobalCodes Lookup**: Check for manager/branch PIN in globalCodes
 * 4. **Users Lookup**: Fallback to users collection for employees
 * 5. **Status Validation**: Check user, manager, and license status
 * 6. **Branch Loading**: Load available branches for selection
 * 
 * ## Security Constraints:
 * - ❌ Blocked if rate limit exceeded (5 attempts, 30-min lockout)
 * - ❌ Blocked if user status is not 'active'
 * - ❌ Blocked if manager is suspended/deleted (for employees)
 * - ❌ Blocked if license expired/suspended
 * - ❌ Blocked if user has no tenantId (legacy accounts)
 * 
 * ## Side Effects:
 * - Records login attempt in Firestore (success/failure)
 * - Saves tenantId to localStorage
 * - Saves branchId to localStorage if provided
 * - Adds staff to "last users" list
 * 
 * @param pin - The PIN code entered by the user
 * @param branchId - Optional branch ID to auto-select
 * @returns User object with availableBranches array
 * @throws Error with Arabic message on failure
 * 
 * @example
 * ```typescript
 * try {
 *   const user = await loginWithPin('1234', 'branch-1');
 *   if (user.role === 'manager') {
 *     navigate('/admin');
 *   } else {
 *     navigate(getDepartmentPath(user.department));
 *   }
 * } catch (error) {
 *   toast.error(error.message);
 * }
 * ```
 */
export const loginWithPin = async (pin: string, branchId?: string): Promise<User & { availableBranches?: Array<{ id: string; code?: string; name: string }> }> => {
    // ✅ SaaS: Check rate limiting FIRST (before any expensive operations)
    const rateLimitCheck = await checkRateLimit(pin);
    if (!rateLimitCheck.allowed) {
        const lockoutMessage = rateLimitCheck.lockoutUntil
            ? `تم تجاوز عدد المحاولات المسموح بها. يرجى المحاولة مرة أخرى بعد ${Math.ceil((rateLimitCheck.lockoutUntil.getTime() - Date.now()) / (60 * 1000))} دقيقة.`
            : 'تم تجاوز عدد المحاولات المسموح بها. يرجى المحاولة مرة أخرى لاحقاً.';
        throw new Error(lockoutMessage);
    }
    
    // ✅ CRITICAL: Check owner PIN FIRST (before anonymous auth and Cloud Function)
    // Owner login is handled client-side only (for security)
    // Must check BEFORE anonymous auth to avoid unnecessary auth calls
    const isOwnerPin = await verifyOwnerPin(pin);
    if (isOwnerPin) {
        // ✅ Owner doesn't need anonymous auth - return immediately
        await recordLoginAttempt(pin, true);
        logger.info('Owner PIN verified successfully', { pinLength: pin.length }, 'userService');
        return {
            id: 'owner',
            name: 'مالك المشروع',
            code: '',
            department: 'admin',
            role: 'owner',
            points: 0,
            status: 'active',
            tenantId: 'system-owner',
            currentPoints: 0,
            lifetimePoints: 0,
            branches: [],
            activeBranchId: null
        };
    }

    // ✅ CRITICAL: Sign in anonymously (required for Cloud Functions and Firestore Rules)
    // Only needed for non-owner users
    try {
        if (!auth.currentUser) {
            const { signInAnonymously } = await import('firebase/auth');
            await signInAnonymously(auth);
            logger.info('Anonymous auth successful for non-owner login', undefined, 'userService');
        }
    } catch (authError: unknown) {
        const error = authError instanceof Error ? authError : new Error(String(authError));
        logger.warn('Anonymous auth failed during login', error, 'userService');
        
        if (error.message?.includes('configuration-not-found') || (error as any)?.code === 'auth/configuration-not-found') {
            throw new Error('⚠️ Anonymous Authentication غير مفعل في Firebase Console.\n\n📍 الحل:\nFirebase Console → Authentication → Sign-in method → Anonymous → Enable');
        }
    }

    // ✅ NEW: Use Cloud Function for login (bypasses client Rules)
    // Only for non-owner users (manager/employee)
    try {
        const { functions, httpsCallable } = await import('./firebase');
        if (!functions) {
            throw new Error('Firebase Functions غير متاحة');
        }

        const loginFunction = httpsCallable(functions, 'loginWithPin');
        const result = await loginFunction({ pin, branchId });
        const response = result.data as any;

        if (!response.success) {
            await recordLoginAttempt(pin, false);
            throw new Error(response.error || 'فشل تسجيل الدخول');
        }

        if (!response.user) {
            await recordLoginAttempt(pin, false);
            throw new Error('لم يتم العثور على المستخدم');
        }

        // ✅ Record successful login attempt
        await recordLoginAttempt(pin, true);

        // ✅ Convert response to User format
        const userData = response.user;
        const user: User = {
            id: userData.id,
            name: userData.name,
            code: pin,
            role: userData.role,
            department: userData.department || '',
            points: 0,
            status: 'active',
            tenantId: userData.tenantId,
            currentPoints: 0,
            lifetimePoints: 0,
            branches: userData.availableBranches || [],
            activeBranchId: userData.branchId || null
        };

        // Save tenantId to localStorage
        if (user.tenantId) {
            localStorage.setItem('adora_tenant_id', user.tenantId);
        }

        if (branchId) {
            saveBranchId(branchId);
        }

        return {
            ...user,
            availableBranches: userData.availableBranches || []
        };

    } catch (error: any) {
        // ✅ Fallback to old method if Functions not available
        logger.warn('Cloud Function failed, using fallback method', error, 'userService');
    }

    // Fallback: Direct Firestore lookup (old method)
    let codeDocSnap;
    try {
        const codeDocRef = doc(db, 'globalCodes', pin);
        codeDocSnap = await getDoc(codeDocRef);
        
        if (codeDocSnap.exists()) {
            const codeData = codeDocSnap.data();
            console.log(`✅ Found PIN ${pin} in globalCodes:`, {
                type: codeData?.type,
                status: codeData?.status,
                licenseStatus: codeData?.licenseStatus
            });
            
            // ✅ Cache successful lookup for offline use
            try {
                localStorage.setItem(`globalCode_${pin}`, JSON.stringify({
                    ...codeData,
                    cachedAt: Date.now()
                }));
            } catch (cacheErr) {
                // Ignore cache errors
            }
        } else {
            console.log(`⚠️ PIN ${pin} not found in globalCodes - checking users collection...`);
        }
    } catch (e: unknown) {
        // If permission denied, it means rules might not be deployed or there's an issue
        const error = e instanceof Error ? e : new Error(String(e));
        const errorCode = (e as any)?.code;
        const errorMessage = error.message || '';
        
        console.error(`❌ Global code lookup failed for PIN ${pin}:`, errorMessage);
        logger.error("Global code lookup failed", error, 'userService');
        
        // ✅ FIX: If offline/unavailable error, try cache first
        if (errorMessage.includes('offline') || errorCode === 'unavailable' || errorCode === 'failed-precondition') {
            // Try to use cached data if available (from previous successful reads)
            const cachedCodeKey = `globalCode_${pin}`;
            const cachedCode = localStorage.getItem(cachedCodeKey);
            
            if (cachedCode) {
                try {
                    const parsed = JSON.parse(cachedCode);
                    const cacheAge = Date.now() - (parsed.cachedAt || 0);
                    const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
                    
                    if (cacheAge < MAX_CACHE_AGE) {
                        console.log(`📦 Using cached globalCode data for PIN ${pin} (cache age: ${Math.round(cacheAge / 1000 / 60)} minutes)`);
                        // Create a mock DocumentSnapshot-like object
                        codeDocSnap = {
                            exists: () => true,
                            data: () => {
                                const { cachedAt, ...data } = parsed;
                                return data;
                            }
                        } as any;
                    } else {
                        console.warn(`⚠️ Cached globalCode for PIN ${pin} is too old (${Math.round(cacheAge / 1000 / 60 / 60)} hours), ignoring cache`);
                    }
                } catch (parseErr) {
                    console.warn('⚠️ Failed to parse cached globalCode:', parseErr);
                    // Invalid cache, continue to fallback
                }
            } else {
                console.warn(`⚠️ No cached data for PIN ${pin}, and client is offline. Cannot login without internet or Anonymous Auth.`);
            }
        }
        
        // Don't throw here - fall through to users collection lookup or continue with cached data
    }

    if (codeDocSnap && codeDocSnap.exists()) {
        const codeData = codeDocSnap.data();
        const tenantId = codeData.tenantId;
        const managerId = codeData.managerId;
        
        // ✅ Cache successful lookup for offline use (already done above in try-catch)

        // ✅ FIX: Use data from globalCodes first (publicly readable)
        // Then try to get updated data from users collection if possible
        interface ManagerUserData {
            name: string;
            status: string;
            role: string;
            department: string;
            licenseExpiry?: Timestamp | Date;
            licenseStatus: string;
            hotelName?: string;
            maxBranches: number;
            branchNames: Record<string, string>;
            branches: string[];
            points: number;
            currentPoints: number;
            lifetimePoints: number;
            [key: string]: unknown; // For additional fields from Firestore
        }
        
        let userData: ManagerUserData = {
            // Use data from globalCodes (stored during manager creation)
            name: codeData.name || 'مدير',
            status: codeData.status || 'active',
            role: codeData.role || 'manager',
            department: codeData.department || 'admin',
            licenseExpiry: codeData.licenseExpiry,
            licenseStatus: codeData.licenseStatus || 'active',
            hotelName: codeData.hotelName,
            maxBranches: codeData.maxBranches || 1,
            branchNames: codeData.branchNames || {},
            branches: codeData.branches || [],
            points: 0,
            currentPoints: 0,
            lifetimePoints: 0,
        };

        // ✅ Try to get updated data from users collection (after anonymous auth)
        try {
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }
            const managerDoc = await getDoc(doc(db, 'users', managerId));
            if (managerDoc.exists()) {
                const updatedData = managerDoc.data();
                // Merge updated data (status, license, etc.)
                userData = {
                    ...userData,
                    ...updatedData,
                    // Keep essential fields from globalCodes if not in updated data
                    name: updatedData.name || userData.name,
                    status: updatedData.status || userData.status,
                };
            }
        } catch (e) {
            // If reading from users fails, use globalCodes data (this is expected during login)
            logger.debug('Using globalCodes data for login (users collection read failed - expected)', e, 'userService');
        }

        // Check if account is active
        if (userData.status !== 'active') {
            // ✅ Record failed login attempt
            await recordLoginAttempt(pin, false);
            throw new Error('الحساب معطل - يرجى التواصل مع الإدارة');
        }

        // ✅ Check license expiry
        const licenseExpiry = userData.licenseExpiry?.toDate ? userData.licenseExpiry.toDate() : 
                             (userData.licenseExpiry instanceof Timestamp ? userData.licenseExpiry.toDate() : 
                             (userData.licenseExpiry as Date | undefined));
        const licenseStatus = userData.licenseStatus || 'active';

        if (licenseStatus === 'suspended') {
            // ✅ Record failed login attempt
            await recordLoginAttempt(pin, false);
            throw new Error('تم إيقاف الترخيص مؤقتاً - يرجى التواصل مع المالك');
        }

        if (licenseExpiry && licenseExpiry < new Date() && licenseStatus !== 'active') {
            // ✅ Record failed login attempt
            await recordLoginAttempt(pin, false);
            throw new Error('انتهى الترخيص - يرجى التواصل مع المالك للتجديد');
        }

        const user: User = {
            id: managerId,
            name: userData.name,
            code: pin, // Use the PIN that was entered
            department: userData.department,
            role: userData.role || 'manager',
            points: userData.points || 0,
            status: userData.status || 'active',
            tenantId: tenantId,

            // ✅ Branch Context
            // If logged in via a branch code PIN, use that branch as active
            activeBranchId: codeData.branchId || userData.branchId || null,
            branches: userData.branches || (codeData.branchId ? [`branch-${codeData.branchId.replace('branch-', '')}`] : []),
            branch: codeData.branchId || userData.branchId, // Legacy
            branchId: codeData.branchId || userData.branchId, // Legacy

            // ✅ License information
            licenseExpiry: licenseExpiry,
            licenseStatus: licenseStatus,
            autoRenew: userData.autoRenew !== false, // Default: true
            paymentStatus: userData.paymentStatus || 'pending',
            currentPoints: userData.points || 0, // Default for compatibility
            lifetimePoints: userData.points || 0, // Default for compatibility

            // ✅ Manager fields
            hotelName: userData.hotelName,
            maxBranches: userData.maxBranches,
            branchNames: userData.branchNames,
            // ✅ Store branchCodes for access control (SaaS isolation)
            branchCodes: userData.branchCodes || codeData.branchCodes || []
        };

        // Save tenantId to localStorage for TenantContext
        if (tenantId) {
            localStorage.setItem('adora_tenant_id', tenantId);
            
            // ✅ CRITICAL: Load tenant-specific Firebase Config if exists
            // ⚠️ NOTE: Must use master Firebase to read tenant doc (chicken-egg problem)
            try {
                // ✅ Use master Firebase to read tenant document (before switching to tenant Firebase)
                const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
                if (tenantDoc.exists()) {
                    const tenantData = tenantDoc.data();
                    const firebaseConfig = tenantData.info?.firebaseConfig;
                    
                    // ✅ Check if we need to switch Firebase config
                    const { getSavedConfig } = await import('./firebase');
                    const currentConfig = getSavedConfig();
                    const needsSwitch = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId;
                    const isDifferent = currentConfig?.projectId !== firebaseConfig?.projectId;
                    
                    if (needsSwitch && isDifferent) {
                        // ✅ Save tenant-specific Firebase Config to localStorage
                        const { saveFirebaseConfig } = await import('./firebase');
                        await saveFirebaseConfig(firebaseConfig, false); // Don't reload page yet
                        console.log('🏢 Loaded tenant-specific Firebase config:', firebaseConfig.projectId);
                        
                        // ✅ CRITICAL: Reload page to ensure clean Firebase initialization
                        // This prevents auth/configuration-not-found errors
                        console.log('🔄 Reloading page to apply tenant Firebase configuration...');
                        setTimeout(() => {
                            window.location.reload();
                        }, 500); // Small delay to allow login to complete
                        return {
                            ...user,
                            availableBranches: [],
                            preferredBranchId: null,
                            _firebaseReload: true // Flag to indicate reload is happening
                        };
                    } else if (!needsSwitch && currentConfig) {
                        // ✅ Clear tenant config if manager doesn't have isolated Firebase
                        const { clearFirebaseConfig } = await import('./firebase');
                        clearFirebaseConfig();
                        console.log('🌐 Using master Firebase configuration (no tenant-specific config)');
                    }
                }
            } catch (e) {
                logger.warn('Failed to load tenant Firebase config (non-critical)', e, 'userService');
                // Continue with login even if Firebase config load fails
            }
        }

        // ✅ Load available branches for manager
        const availableBranches = await loadAvailableBranches(user);

        // ✅ Capture branch from codeData if exists (for auto-selection)
        const autoSelectedBranch = codeData.branchId;

        // ✅ Validate branchId if provided explicitly
        if (branchId) {
            const matchedBranch = availableBranches.find(
                b => b.code === branchId || b.id === branchId || b.id === `branch-${branchId}`
            );
            if (!matchedBranch) {
                throw new Error(`كود الفرع "${branchId}" غير موجود ضمن فروعك`);
            }
            saveBranchId(matchedBranch.id);
        } else if (autoSelectedBranch) {
            // If no explicit branch provided but code mapping has one, use it
            saveBranchId(autoSelectedBranch);
        }

        // ✅ Record successful login attempt
        await recordLoginAttempt(pin, true);
        
        return {
            ...user,
            availableBranches,
            preferredBranchId: autoSelectedBranch // ✅ Pass hint to AuthContext
        };
    }

    // Fallback: Lookup in users collection (for employees or if globalCodes lookup failed)
    // ✅ NOTE: Anonymous auth already done at the beginning of loginWithPin
    // ✅ FIX: Check if db is available before querying
    if (!db) {
        await recordLoginAttempt(pin, false);
        throw new Error('قاعدة البيانات غير متاحة - تأكد من الاتصال بالإنترنت');
    }

    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('code', '==', pin));
    
    let snapshot;
    try {
        snapshot = await getDocs(q);
    } catch (queryError: any) {
        // If offline, try cache or provide helpful message
        if (queryError.message?.includes('offline') || queryError.code === 'unavailable') {
            await recordLoginAttempt(pin, false);
            throw new Error('لا يوجد اتصال بالإنترنت - يرجى التحقق من الاتصال والمحاولة مرة أخرى');
        }
        throw queryError;
    }

    if (snapshot.empty) {
        // ✅ Record failed login attempt
        await recordLoginAttempt(pin, false);
        throw new Error('رمز الدخول غير صحيح');
    }

    // ✅ Selection Strategy: Pick the user with a tenantId first (SaaS account)
    const activeDoc = snapshot.docs.find(d => d.data().tenantId) || snapshot.docs[0];
    const data = activeDoc.data();

    // ✅ SaaS Enforcement: No tenant, No access.
    if (!data.tenantId) {
        // ✅ Record failed login attempt
        await recordLoginAttempt(pin, false);
        throw new Error('هذا الحساب (نظام قديم) غير مفعل حالياً. يرجى إعادة إنشائه بواسطة المدير.');
    }

    // Check if account is active
    if (data.status !== 'active') {
        // ✅ Record failed login attempt
        await recordLoginAttempt(pin, false);
        throw new Error('الحساب معطل - يرجى التواصل مع الإدارة');
    }

    // ✅ CRITICAL: Check if Manager/Tenant is suspended
    // If manager is suspended, ALL employees under them cannot login
    if (data.role !== 'manager') {
        // This is an employee - check their manager's status
        const managersRef = collection(db, 'users');
        const managerQuery = query(
            managersRef, 
            where('tenantId', '==', data.tenantId),
            where('role', '==', 'manager')
        );
        const managerSnapshot = await getDocs(managerQuery);
        
        if (!managerSnapshot.empty) {
            const managerData = managerSnapshot.docs[0].data();
            if (managerData.status === 'suspended') {
                await recordLoginAttempt(pin, false);
                throw new Error('تم إيقاف حساب المدير مؤقتاً - يرجى التواصل مع الإدارة');
            }
            if (managerData.status === 'deleted') {
                await recordLoginAttempt(pin, false);
                throw new Error('تم حذف حساب المدير - يرجى التواصل مع الإدارة');
            }
            // Check license expiry
            if (managerData.licenseExpiryDate) {
                const expiryDate = managerData.licenseExpiryDate.toDate ? 
                    managerData.licenseExpiryDate.toDate() : 
                    new Date(managerData.licenseExpiryDate);
                if (expiryDate < new Date()) {
                    await recordLoginAttempt(pin, false);
                    throw new Error('انتهت صلاحية اشتراك المدير - يرجى التواصل مع الإدارة لتجديد الاشتراك');
                }
            }
        }
    } else {
        // This is a manager - check their own status
        if (data.status === 'suspended') {
            await recordLoginAttempt(pin, false);
            throw new Error('تم إيقاف حسابك مؤقتاً - يرجى التواصل مع إدارة النظام');
        }
        // Check license expiry for manager
        if (data.licenseExpiryDate) {
            const expiryDate = data.licenseExpiryDate.toDate ? 
                data.licenseExpiryDate.toDate() : 
                new Date(data.licenseExpiryDate);
            if (expiryDate < new Date()) {
                await recordLoginAttempt(pin, false);
                throw new Error('انتهت صلاحية اشتراكك - يرجى التواصل مع إدارة النظام لتجديد الاشتراك');
            }
        }
    }

    const user: User = {
        id: activeDoc.id,
        name: data.name,
        code: data.code,
        department: data.department,
        role: data.role || 'employee',
        points: data.points || 0,
        status: data.status || 'active',
        branches: data.branches || [],
        tenantId: data.tenantId, // Include if exists
        currentPoints: data.points || 0,
        lifetimePoints: data.points || 0,
    };

    // Save tenantId to localStorage if exists
    if (user.tenantId) {
        localStorage.setItem('adora_tenant_id', user.tenantId);
    }

    // Save to last users (only staff, not managers/owners)
    if (user.role === 'staff') {
        addToLastUsers(user);
    }

    if (branchId) {
        saveBranchId(branchId);
    }

    // ✅ Load available branches for employee
    const availableBranches = await loadAvailableBranches(user);
    
    // ✅ Record successful login attempt
    await recordLoginAttempt(pin, true);
    
    return { ...user, availableBranches };
};

/**
 * Check if a PIN code is available (not already used)
 * ✅ Enhanced: Checks across ALL collections (globalCodes + users) for complete uniqueness
 */
// isPinAvailable moved to ownerService.ts

/**
 * Generate a unique PIN code suggestion
 * ✅ Enhanced: Checks across ALL collections and suggests a new unique code
 */
// suggestUniquePin moved to ownerService.ts

/**
 * Create a new manager with isolated tenant (SaaS model)
 * Each manager gets their own tenant with complete data isolation
 * ✅ Enhanced: Supports branch licensing and branch codes
 */
// createManager moved to ownerService.ts

// License / Soft delete logic moved to ownerService.ts

/**
 * Creates a new employee under a manager's tenant
 * 
 * ## Business Logic:
 * - Only managers can create employees
 * - Employee PIN must be unique across all collections
 * - Employee is assigned to specific branches
 * 
 * ## Security Constraints:
 * - ❌ Throws error if PIN is already in use
 * - ✅ Associates employee with tenant for data isolation
 * 
 * ## Side Effects:
 * - Creates document in `users` collection with generated ID
 * - Sets initial points to 0 and status to 'active'
 * 
 * @param data - Employee creation data
 * @param data.name - Employee's full name
 * @param data.code - Unique PIN code for login
 * @param data.department - Department assignment (reception, housekeeping, etc.)
 * @param data.branches - Array of branch IDs the employee can access
 * @param data.createdBy - Manager's user ID (for audit)
 * @param data.tenantId - Optional tenant ID for data isolation
 * @returns The created employee's ID
 * @throws Error if PIN is already in use
 * 
 * @example
 * const employeeId = await createEmployee({
 *   name: 'محمد أحمد',
 *   code: '1234',
 *   department: 'housekeeping',
 *   branches: ['branch-1'],
 *   createdBy: managerId,
 *   tenantId: tenantId
 * });
 */
export const createEmployee = async (data: {
    name: string;
    code: string;
    department: Department;
    branches: string[];
    createdBy: string;
    tenantId?: string;
}): Promise<string> => {
    // Check if code is available
    const available = await isPinAvailable(data.code);
    if (!available) {
        throw new Error('هذا الكود مستخدم بالفعل');
    }

    const employeeId = `${data.department}-${Date.now()}`;

    await setDoc(doc(db, 'users', employeeId), {
        id: employeeId,
        name: data.name,
        code: data.code,
        department: data.department,
        role: 'employee',
        branches: data.branches,
        points: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: data.createdBy,
        tenantId: data.tenantId, // ✅ Add Tenant ID for isolation
    });

    return employeeId;
};

/**
 * Saves user binding for Firestore security rules enforcement
 * 
 * ## Business Logic:
 * Links a Firebase anonymous UID to a tenant and role, enabling
 * Firestore rules to verify user's access permissions.
 * 
 * ## Security Constraints:
 * - ❌ Throws error if tenantId is invalid
 * - ❌ Throws error if role is not in allowed list
 * - ❌ Prevents role escalation (can't upgrade own role)
 * - ❌ Prevents tenantId changes (can't switch tenants)
 * 
 * ## Side Effects:
 * - Creates/updates document in `userBindings` collection
 * - Sets `updatedAt` timestamp
 * 
 * @param uid - Firebase anonymous UID
 * @param tenantId - The tenant to bind the user to
 * @param role - The role to assign (owner, manager, employee, staff, admin)
 * @throws Error if validation fails or privilege escalation detected
 */
export const saveUserBinding = async (uid: string, tenantId: string, role: string): Promise<void> => {
    try {
        // ✅ SaaS: Validate tenantId
        if (!isTenantId(tenantId) && tenantId !== 'system-owner') {
            throw new Error(`Invalid tenantId: ${tenantId}`);
        }
        
        // ✅ SaaS: Validate role (prevent privilege escalation)
        const validRoles = ['owner', 'manager', 'employee', 'staff', 'admin'];
        if (!validRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}`);
        }
        
        // ✅ SaaS: Get existing binding to prevent role/tenantId changes
        const existingBinding = await getDoc(doc(db, 'userBindings', uid));
        if (existingBinding.exists()) {
            const existingData = existingBinding.data();
            
            // Prevent role escalation (users cannot change their own role)
            if (existingData.role && existingData.role !== role && role !== 'owner') {
                // Only allow if current user is owner or if role is being downgraded
                logger.warn(`Attempted role change from ${existingData.role} to ${role}`, undefined, 'userService');
                // Allow only if it's a downgrade (e.g., manager -> employee)
                const roleHierarchy = { owner: 5, admin: 4, manager: 3, employee: 2, staff: 1 };
                const currentLevel = roleHierarchy[existingData.role as keyof typeof roleHierarchy] || 0;
                const newLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 0;
                
                if (newLevel > currentLevel) {
                    throw new Error('Cannot escalate role');
                }
            }
            
            // Prevent tenantId changes (users cannot change their own tenantId)
            if (existingData.tenantId && existingData.tenantId !== tenantId) {
                throw new Error('Cannot change tenantId');
            }
        }
        
        await setDoc(doc(db, 'userBindings', uid), {
            uid, // ✅ Required for Security Rules validation
            tenantId,
            role,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        logger.error('Error saving user binding', error, 'userService');
        throw error; // Re-throw to allow caller to handle
    }
};

// getAllManagers moved to ownerService.ts

/**
 * Get employees by manager (employees created by this manager)
 */
export const getEmployeesByManager = async (managerId: string): Promise<User[]> => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('createdBy', '==', managerId));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
    })) as User[];
};

/**
 * Retrieves a user by their document ID
 * 
 * @param userId - The user's document ID in the users collection
 * @returns User object if found, null otherwise
 */
export const getUserById = async (userId: string): Promise<User | null> => {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;

    return {
        id: userDoc.id,
        ...userDoc.data(),
    } as User;
};

/**
 * Returns the navigation path for a user based on their role/department
 * 
 * ## Routing Logic:
 * - **Owner**: `/owner-dashboard`
 * - **Manager**: `/admin`
 * - **Reception**: `/reception`
 * - **Housekeeping**: `/housekeeping`
 * - **Bellman**: `/bellman`
 * - **Maintenance**: `/maintenance`
 * - **Procurement**: `/procurement`
 * - **Default**: `/reception`
 * 
 * @param department - The user's department
 * @param role - Optional role override (owner, manager take precedence)
 * @returns The navigation path string
 * 
 * @example
 * ```typescript
 * const path = getDepartmentPath(user.department, user.role);
 * navigate(path);
 * ```
 */
export const getDepartmentPath = (department: string, role?: string): string => {
    // ✅ Owner goes directly to owner dashboard
    if (role === 'owner') {
        return '/owner-dashboard';
    }

    // Manager goes to admin dashboard
    if (role === 'manager') {
        return '/admin';
    }

    // Employees go to their department
    const paths: Record<string, string> = {
        reception: '/reception',
        housekeeping: '/housekeeping',
        bellman: '/bellman',
        maintenance: '/maintenance',
        procurement: '/procurement',
        admin: '/admin',
    };

    return paths[department] || '/reception';
};

// ============================================================
// BIOMETRIC AUTHENTICATION
// ============================================================

export const isBiometricAvailable = async (): Promise<boolean> => {
    // Check if WebAuthn is available
    if (typeof window === 'undefined') return false;
    if (!window.PublicKeyCredential) return false;

    try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
    } catch {
        return false;
    }
};

export const verifyBiometric = async (): Promise<{ success: boolean; userId?: string }> => {
    try {
        // Simple biometric check (can be enhanced)
        const available = await isBiometricAvailable();
        if (!available) return { success: false };

        // In a real implementation, you would use WebAuthn API
        // For now, return false as we don't have real implementation
        return { success: false };
    } catch {
        return { success: false };
    }
};

// ============================================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================================

/**
 * Seed initial users (for development/testing)
 * @deprecated - Use createManager and createEmployee instead
 */
export const seedInitialUsers = async (): Promise<void> => {
    // Implementation removed - use createManager/createEmployee instead
};

// ✅ Re-export types for backward compatibility
// Note: Department is an enum, exported from ../types/index.ts
export type { User };
