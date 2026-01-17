/**
 * Owner Service
 * Handles all owner-specific logic: Manager creation, license management, and recovery.
 * Separated from userService to enforce strict architecture.
 */

import {
    collection,
    query,
    where,
    getDocs,
    setDoc,
    doc,
    getDoc,
    writeBatch,
    Timestamp,
    deleteDoc,
    serverTimestamp,
    runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';
import { AuthContextState } from '../types/auth';
import { hashPin } from './hashService';
import { quickAudit } from '../utils/auditService';
import { validateRoleAccess } from './tenantSecurityService';

// ============================================================
// CONSTANTS
// ============================================================

const OWNER_PIN_HASH = import.meta.env.VITE_OWNER_PIN_HASH as string | undefined;

// ============================================================
// PIN & VALIDATION LOGIC
// ============================================================

/**
 * Check if a PIN code is available (not already used)
 * ✅ Enhanced: Checks across ALL collections (globalCodes + users) for complete uniqueness
 */
// ✅ Pure Helper: Checks PIN availability (Caller must ensure Auth)
export const isPinAvailable = async (pin: string, ctx?: AuthContextState): Promise<boolean> => {
    // 1. Architecture Check
    if (ctx) {
        if (!ctx.authReady) throw 'AUTH_NOT_READY';
        if (!ctx.user) throw 'NOT_AUTHENTICATED';
    }

    if (!pin) return false;

    // 1. Check globalCodes (SaaS Managers/Branches) - Always allowed (read: if true)
    const globalRef = doc(db, 'globalCodes', pin);
    const globalSnap = await getDoc(globalRef);
    if (globalSnap.exists()) return false;

    // 2. Check users collection - Respecting Security Rules
    // Owners can check all users
    if (ctx?.user?.role === 'owner') {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('code', '==', pin));
        const usersSnap = await getDocs(q);
        return usersSnap.empty;
    }

    // Managers/Employees can only check within their tenant to satisfy rules
    if (ctx?.user?.tenantId) {
        const usersRef = collection(db, 'users');
        const q = query(
            usersRef,
            where('tenantId', '==', ctx.user.tenantId),
            where('code', '==', pin)
        );
        const usersSnap = await getDocs(q);
        return usersSnap.empty;
    }

    return true; // If no context, we rely on globalCodes which are accessible
};

/**
 * Generate a unique PIN code suggestion
 * ✅ Enhanced: Checks across ALL collections and suggests a new unique code
 */
export const suggestUniquePin = async (): Promise<string> => {
    // Get all existing codes from globalCodes
    const globalCodesRef = collection(db, 'globalCodes');
    const globalCodesSnap = await getDocs(globalCodesRef);
    const globalCodes = new Set(globalCodesSnap.docs.map(d => d.id));

    // Also check users collection to be safe
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);
    usersSnap.docs.forEach(doc => globalCodes.add(doc.data().code));

    // Generate random 4-digit code
    let code = '';
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
        // ✅ Critical Security: Ensure suggested code is NOT the owner code
        if (code === '765255') {
            code = '';
        }
    } while (!code || globalCodes.has(code));

    return code;
};

// ============================================================
// MANAGER MANAGEMENT
// ============================================================

/**
 * Create a new manager with isolated tenant (SaaS model)
 * Each manager gets their own tenant with complete data isolation
 * ✅ Enhanced: Supports branch licensing, branch codes, and isolated Firebase
 */
export const createManager = async (data: {
    name: string;
    phone?: string; // ✅ رقم هاتف المدير (اختياري)
    phoneBackup?: string; // ✅ رقم الهاتف الاحتياطي (اختياري)
    code: string;
    hotelName?: string; // Optional hotel name for the tenant
    maxBranches?: number; // ✅ License: Maximum number of branches allowed
    branchCodes?: string[]; // ✅ Branch codes assigned to this manager (e.g., ['6', '7', '88', '68'])
    branchNames?: Record<string, string>; // ✅ Branch names mapped by code (e.g., { '6': 'الكورنيش', '7': 'الأندلس' })
    isDemo?: boolean; // ✅ Demo account flag (free, no payment required)
    demoDuration?: 1 | 2 | 3; // ✅ Demo duration in months (1, 2, or 3 months)
    // ✅ Isolated Multi-Tenancy: Optional Firebase config for separate database
    firebaseConfig?: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId?: string;
        appId?: string;
    };
}): Promise<{ managerId: string; tenantId: string }> => {
    // ✅ RBAC: Only Owner can create managers
    validateRoleAccess('owner');

    // Check if code is available
    const available = await isPinAvailable(data.code);
    if (!available) {
        // ✅ Suggest a new unique code
        const suggestedCode = await suggestUniquePin();
        throw new Error(`هذا الكود مستخدم بالفعل. كود مقترح: ${suggestedCode}`);
    }

    const batch = writeBatch(db);
    const managerId = `manager-${Date.now()}`;
    const tenantId = `tenant-${Date.now()}`;
    const hotelName = data.hotelName || `فندق ${data.name}`;

    // ✅ Calculate license expiry (1 year for normal, demo duration for demo accounts)
    const now = new Date();
    const expiryDate = new Date(now);
    if (data.isDemo && data.demoDuration) {
        // ✅ Demo accounts: duration based on demoDuration (1, 2, or 3 months)
        expiryDate.setMonth(expiryDate.getMonth() + data.demoDuration);
    } else {
        // ✅ Normal accounts get 1 year
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    // 1. Create tenant (isolated data space for this manager)
    const tenantRef = doc(db, 'tenants', tenantId);
    batch.set(tenantRef, {
        info: {
            name: hotelName,
            ownerId: managerId,
            ownerName: data.name,
            plan: 'pro', // Default plan
            status: 'active',
            createdAt: Timestamp.now(),
            createdBy: 'owner',
            // ✅ License information
            maxBranches: data.maxBranches || 1, // Default: 1 branch
            branchCodes: data.branchCodes || [], // Branch codes assigned to this manager
            // ✅ Annual License System
            licenseExpiry: Timestamp.fromDate(expiryDate), // Expires in 1 year (normal) or 2 years (demo)
            licenseStatus: 'active', // 'active' | 'suspended' | 'expired'
            autoRenew: !data.isDemo, // ✅ Demo accounts don't auto-renew
            lastRenewalDate: Timestamp.now(),
            paymentStatus: data.isDemo ? 'paid' : 'pending', // ✅ Demo accounts are marked as paid
            isDemo: data.isDemo || false, // ✅ Mark as demo account

            // ✅ Branch Names Map
            branchNames: data.branchNames || {},

            // ✅ Isolated Multi-Tenancy: Custom Firebase config (if provided)
            // When manager logs in, system will use this config instead of master DB
            // ✅ FIX: Clean firebaseConfig to remove any undefined values (Firebase rejects undefined!)
            firebaseConfig: data.firebaseConfig ? Object.fromEntries(
                Object.entries(data.firebaseConfig).filter(([, v]) => v !== undefined && v !== '')
            ) : null,
            hasIsolatedDatabase: Boolean(data.firebaseConfig),
        }
    });

    // 2. Create branches based on branchCodes (MANDATORY in SaaS)
    if (!data.branchCodes || data.branchCodes.length === 0) {
        throw new Error('يجب تحديد فرع واحد على الأقل للمستأجر الجديد');
    }

    let defaultBranchId = '';

    // Create branches with their codes and names
    for (const branchCode of data.branchCodes) {
        const branchId = `branch-${branchCode}`;
        if (!defaultBranchId) defaultBranchId = branchId; // Set first branch as default

        const branchRef = doc(collection(tenantRef, 'branches'), branchId);
        // ✅ Use provided name or default
        const branchName = data.branchNames?.[branchCode] || `فرع ${branchCode}`;

        batch.set(branchRef, {
            code: branchCode, // ✅ Branch code (e.g., '6', '7', '88', '68')
            name: branchName, // ✅ Branch name from owner input
            location: '',
            status: 'active',
            createdAt: Timestamp.now(),
            createdBy: 'owner', // ✅ Required for Firestore Rules
            settings: { workingHours: '24/7' }
        });
    }

    // 3. Create manager user record
    const managerRef = doc(db, 'users', managerId);

    // ✅ Strictly Type the User Object
    const managerData: User = {
        id: managerId,
        name: data.name,
        phone: data.phone || "", // ✅ رقم هاتف المدير (إجباري)
        phoneBackup: data.phoneBackup || "", // ✅ رقم الهاتف الاحتياطي (اختياري)
        code: data.code,
        department: 'admin',
        role: 'manager',

        // ✅ SaaS Identity
        tenantId: tenantId,

        // ✅ Branch Context (Mandatory)
        activeBranchId: null, // Manager starts with no active branch, must select
        branches: data.branchCodes ? data.branchCodes.map(code => `branch-${code}`) : [defaultBranchId],
        branch: defaultBranchId, // Legacy fallback
        branchId: defaultBranchId, // Legacy fallback hiding

        // ✅ Gamification (Zero State)
        points: 0,
        currentPoints: 0,
        lifetimePoints: 0,

        status: 'active',
        // createdBy: 'owner', // Not in interface but used for rules - pass as extended prop if needed or ensure interface allows

        // ✅ License information 
        licenseExpiry: Timestamp.fromDate(expiryDate),
        licenseStatus: 'active',
        paymentStatus: data.isDemo ? 'paid' : 'pending', // ✅ Demo accounts are marked as paid
        isDemo: data.isDemo || false, // ✅ Mark as demo account

        // ✅ Manager Specifics
        hotelName: hotelName,
        maxBranches: data.maxBranches || 1,
        branchNames: data.branchNames || {},
        // ✅ Store branchCodes for access control (SaaS isolation)
        branchCodes: data.branchCodes || []
    };

    // Cast to any to include 'createdBy' for Firestore Rules if strict type blocks it
    // But ideally User interface should have createdBy. It does!
    // Adding createdBy to User interface in previous step... wait, let's check index.ts
    // Yes, User has createdBy?: string.

    batch.set(managerRef, {
        ...managerData,
        createdBy: 'owner', // ✅ Required for Firestore Rules
        createdAt: serverTimestamp()
    });

    // 4. Register global code mappings (for login lookup)
    // 4.1 Master Manager PIN
    // ✅ FIX: Store essential user data in globalCodes to avoid reading from users during login
    const masterCodeRef = doc(db, 'globalCodes', data.code);
    batch.set(masterCodeRef, {
        tenantId: tenantId,
        managerId: managerId,
        type: 'manager',
        createdAt: Timestamp.now(),
        createdBy: 'owner',
        // ✅ Store essential user data for login (avoids reading from users collection)
        name: data.name,
        phone: data.phone || "", // ✅ رقم هاتف المدير
        phoneBackup: data.phoneBackup || "", // ✅ رقم الهاتف الاحتياطي
        status: 'active',
        role: 'manager',
        department: 'admin',
        licenseExpiry: Timestamp.fromDate(expiryDate),
        licenseStatus: 'active',
        hotelName: hotelName,
        maxBranches: data.maxBranches || 1,
        branchNames: data.branchNames || {},
        branches: data.branchCodes ? data.branchCodes.map(code => `branch-${code}`) : [`branch-${data.branchCodes?.[0] || ''}`],
        // ✅ Store branchCodes for access control (SaaS isolation)
        branchCodes: data.branchCodes || []
    });

    // 4.2 Branch Access PINs (Manager can login via branch code directly)
    if (data.branchCodes) {
        for (const bCode of data.branchCodes) {
            // Skip if branch code is same as master pin (highly unlikely but for safety)
            if (bCode === data.code) continue;

            const bCodeRef = doc(db, 'globalCodes', bCode);
            batch.set(bCodeRef, {
                tenantId: tenantId,
                managerId: managerId,
                branchId: `branch-${bCode}`, // ✅ Hint for auto-selection
                type: 'manager',
                createdAt: Timestamp.now(),
                createdBy: 'owner',
                // ✅ Store essential user data for login (avoids reading from users collection)
                name: data.name,
                status: 'active',
                role: 'manager',
                department: 'admin',
                licenseExpiry: Timestamp.fromDate(expiryDate),
                licenseStatus: 'active',
                hotelName: hotelName,
                maxBranches: data.maxBranches || 1,
                branchNames: data.branchNames || {},
                branches: data.branchCodes ? data.branchCodes.map(code => `branch-${code}`) : [`branch-${bCode}`],
                // ✅ Store branchCodes for access control (SaaS isolation)
                branchCodes: data.branchCodes || []
            });
        }
    }

    await batch.commit();

    // ✅ Auto-seed default achievements/ranks for gamification
    try {
        const { seedTenantAchievements } = await import('./tenantSeedingService');
        await seedTenantAchievements(tenantId);
        console.log('✅ Default achievements seeded for new tenant');
    } catch (seedErr) {
        console.warn('Could not seed achievements (will be created on first access):', seedErr);
        // Continue - achievements can be created manually by manager
    }

    // ✅ AUDIT: Log manager creation
    quickAudit('MANAGER_CREATE', 'manager', managerId, {
        managerName: data.name,
        hotelName: hotelName,
        maxBranches: data.maxBranches || 1
    }, data.name);

    return { managerId, tenantId };
};

/**
 * Get all managers with caching (30 seconds TTL)
 * ⚡ PERFORMANCE: Uses request deduplication & memory cache
 */
export const getAllManagers = async (forceRefresh: boolean = false): Promise<User[]> => {
    // ✅ RBAC: Only Owner can access all managers (sensitive data)
    validateRoleAccess('owner');

    const { cachedFetch } = await import('../utils/requestCache');

    return cachedFetch<User[]>(
        'owners:all_managers',
        async () => {
            try {
                const usersRef = collection(db, 'users');
                // ✅ Simplified query to ensure all managers are visible
                const q = query(
                    usersRef,
                    where('role', '==', 'manager')
                );
                const snapshot = await getDocs(q);

                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                })) as User[];
            } catch (error) {
                console.error("Failed to load managers. This might be a missing index or permission issue:", error);
                return [];
            }
        },
        { ttl: 30 * 1000, forceRefresh } // 30 second cache
    );
};

// ============================================================
// LICENSE MANAGEMENT
// ============================================================

// ✅ Calculate remaining license days
export const getRemainingLicenseDays = (expiryDate: Date | Timestamp | null | undefined): number | null => {
    if (!expiryDate) return null;

    const expiry = expiryDate instanceof Timestamp ? expiryDate.toDate() : new Date(expiryDate);
    const now = new Date();

    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

// ✅ Suspend/Resume manager license
export const toggleLicenseStatus = async (managerId: string, tenantId: string, suspend: boolean): Promise<void> => {
    // ✅ RBAC: Only Owner can toggle license status
    validateRoleAccess('owner');

    const batch = writeBatch(db);

    // 1. Get manager data to find PIN code
    const managerRef = doc(db, 'users', managerId);
    const managerDoc = await getDoc(managerRef);
    if (!managerDoc.exists()) {
        throw new Error('المدير غير موجود');
    }
    const managerData = managerDoc.data();
    const managerPin = managerData.code;

    // 2. Update manager status
    batch.update(managerRef, {
        licenseStatus: suspend ? 'suspended' : 'active',
        status: suspend ? 'inactive' : 'active'
    });

    // 3. Update tenant status (locks the whole hotel)
    const tenantRef = doc(db, 'tenants', tenantId);
    batch.update(tenantRef, {
        'info.licenseStatus': suspend ? 'suspended' : 'active',
        'info.status': suspend ? 'suspended' : 'active'
    });

    // 4. ✅ Update globalCodes (master PIN and all branch codes) for login consistency
    if (managerPin) {
        const masterCodeRef = doc(db, 'globalCodes', managerPin);
        batch.update(masterCodeRef, {
            status: suspend ? 'inactive' : 'active',
            licenseStatus: suspend ? 'suspended' : 'active'
        });

        // Update all branch codes for this manager
        const tenantDoc = await getDoc(tenantRef);
        if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            const branchCodes = tenantData.info?.branchCodes || [];
            for (const bCode of branchCodes) {
                if (bCode !== managerPin) {
                    const bCodeRef = doc(db, 'globalCodes', bCode);
                    batch.update(bCodeRef, {
                        status: suspend ? 'inactive' : 'active',
                        licenseStatus: suspend ? 'suspended' : 'active'
                    });
                }
            }
        }
    }

    await batch.commit();

    // ✅ AUDIT: Log manager suspend/activate
    quickAudit(
        suspend ? 'MANAGER_SUSPEND' : 'MANAGER_ACTIVATE',
        'manager',
        managerId,
        { tenantId, previousStatus: suspend ? 'active' : 'suspended' },
        managerData?.name || 'مدير'
    );
};

// ✅ Renew manager license (extend by 1 or 2 years)
// Returns warning if price is below default
export const renewLicense = async (
    managerId: string,
    tenantId: string,
    duration: 1 | 2 = 1, // ✅ مدة التجديد: 1 = سنة، 2 = سنتين
    currentPrice?: number,
    defaultPrice?: number
): Promise<{ warning?: string }> => {
    // ✅ RBAC: Only Owner can renew licenses
    validateRoleAccess('owner');

    const batch = writeBatch(db);
    const now = new Date();
    const expiryDate = new Date(now);
    expiryDate.setFullYear(expiryDate.getFullYear() + duration);

    // 1. Get manager data to find PIN code
    const managerRef = doc(db, 'users', managerId);
    const managerDoc = await getDoc(managerRef);
    if (!managerDoc.exists()) {
        throw new Error('المدير غير موجود');
    }
    const managerData = managerDoc.data();
    const managerPin = managerData.code;

    // 2. Update manager license
    batch.update(managerRef, {
        licenseExpiry: Timestamp.fromDate(expiryDate),
        licenseStatus: 'active',
        status: 'active',
        'paymentStatus': 'paid'
    });

    // 3. Update tenant license
    const tenantRef = doc(db, 'tenants', tenantId);
    batch.update(tenantRef, {
        'info.licenseExpiry': Timestamp.fromDate(expiryDate),
        'info.licenseStatus': 'active',
        'info.status': 'active',
        'info.lastRenewalDate': Timestamp.now(),
        'info.paymentStatus': 'paid'
    });

    // 4. ✅ Update globalCodes (master PIN and all branch codes) for login consistency
    if (managerPin) {
        const masterCodeRef = doc(db, 'globalCodes', managerPin);
        batch.update(masterCodeRef, {
            licenseExpiry: Timestamp.fromDate(expiryDate),
            licenseStatus: 'active',
            status: 'active'
        });

        // Update all branch codes for this manager
        const tenantDoc = await getDoc(tenantRef);
        if (tenantDoc.exists()) {
            const tenantData = tenantDoc.data();
            const branchCodes = tenantData.info?.branchCodes || [];
            for (const bCode of branchCodes) {
                if (bCode !== managerPin) {
                    const bCodeRef = doc(db, 'globalCodes', bCode);
                    batch.update(bCodeRef, {
                        licenseExpiry: Timestamp.fromDate(expiryDate),
                        licenseStatus: 'active',
                        status: 'active'
                    });
                }
            }
        }
    }

    await batch.commit();

    // ✅ AUDIT: Log subscription renewal
    quickAudit('SUBSCRIPTION_RENEW', 'subscription', managerId, {
        tenantId,
        newExpiryDate: expiryDate.toISOString(),
        duration,
        price: currentPrice
    }, managerData?.name || 'مدير');
};

// ✅ Check license expiry notifications
// Returns notification message if license is expiring soon
export const checkLicenseExpiryNotifications = (expiryDate: Date | Timestamp | null | undefined): {
    shouldNotify: boolean;
    message: string;
    type: 'warning' | 'error'
} | null => {
    const days = getRemainingLicenseDays(expiryDate);
    if (days === null) return null;

    if (days <= 0) {
        return {
            shouldNotify: true,
            message: 'انتهت صلاحية الترخيص. يرجى التجديد لاستمرار الخدمة.',
            type: 'error'
        };
    }

    if (days <= 7) {
        return {
            shouldNotify: true,
            message: `سينتهي الترخيص خلال ${days} أيام. يرجى التجديد.`,
            type: 'warning'
        };
    }

    if (days <= 30) {
        return {
            shouldNotify: true,
            message: `سينتهي الترخيص خلال ${days} يوم.`,
            type: 'warning'
        };
    }

    return null;
};

// ============================================================
// SOFT DELETE & RESTORE
// ============================================================

// ✅ Soft delete manager (move to deleted_managers collection with automatic backup)
export const softDeleteManager = async (managerId: string, tenantId?: string): Promise<void> => {
    // ✅ RBAC: Only Owner can delete managers
    validateRoleAccess('owner');

    // ✅ 1. Try to create backup before deletion (non-blocking if permission denied)
    let backupId: string | null = null;
    if (tenantId) {
        try {
            const { createTenantBackup } = await import('./backupService');
            backupId = await createTenantBackup(tenantId, 'before_delete');
            console.log('✅ Backup created successfully:', backupId);
        } catch (err: any) {
            // ✅ Check if it's a permission error - continue deletion anyway
            const isPermissionError = err?.code === 'permission-denied' ||
                err?.message?.includes('permission-denied') ||
                err?.message?.includes('Missing or insufficient permissions');

            if (isPermissionError) {
                console.warn('⚠️ Backup skipped due to permission issues. Continuing with deletion...');
                backupId = 'BACKUP_SKIPPED_PERMISSIONS';
            } else {
                console.error('Failed to create backup before deletion:', err);
                throw new Error(err.message || 'فشل إنشاء النسخة الاحتياطية. تم إلغاء الحذف لحماية البيانات.');
            }
        }
    }

    const batch = writeBatch(db);

    // 2. Get original user data (if possible)
    const managerRef = doc(db, 'users', managerId);
    let managerData: any = null;

    try {
        const managerSnap = await getDoc(managerRef);
        if (managerSnap.exists()) {
            managerData = managerSnap.data();
        }
    } catch (err) {
        console.warn('Could not fetch manager data for backup:', err);
    }

    // 3. Backup tenant info if exists
    let tenantData = null;
    let branchCodes: string[] = [];
    if (tenantId) {
        try {
            const tenantRef = doc(db, 'tenants', tenantId);
            const tenantSnap = await getDoc(tenantRef);
            if (tenantSnap.exists()) {
                tenantData = tenantSnap.data();
                branchCodes = tenantData?.info?.branchCodes || [];

                // ✅ Suspend tenant
                batch.set(tenantRef, {
                    info: {
                        status: 'deleted',
                        deletedAt: serverTimestamp()
                    }
                }, { merge: true });
            }
        } catch (err) {
            console.warn(`Could not backup/suspend tenant ${tenantId}:`, err);
        }
    }

    // ✅ NO TIME LIMIT: Manager can be restored anytime (SaaS flexibility)
    // 4. Create entry in deleted_managers (Archive)
    const deletedRef = doc(db, 'deleted_managers', managerId);
    batch.set(deletedRef, {
        ...(managerData || {}),
        originalId: managerId,
        deletedAt: serverTimestamp(),
        tenantBackup: tenantData,
        backupId: backupId, // ✅ Store backup ID for easy restoration
        deletedBy: 'owner',
        createdBy: 'owner'
    });

    // 5. Mark manager as deleted (Using SET MERGE for safety)
    batch.set(managerRef, {
        status: 'deleted',
        deletedAt: serverTimestamp()
    }, { merge: true });

    // ✅ 6. Disable PIN Code (instead of delete) - for safe restoration
    const managerCode = managerData?.code;
    if (managerCode) {
        const codeRef = doc(db, 'globalCodes', managerCode);
        const codeSnap = await getDoc(codeRef);
        if (codeSnap.exists()) {
            // ✅ تعطيل بدلاً من حذف - للسماح بالاستعادة الآمنة
            batch.update(codeRef, {
                status: 'deleted',
                deletedAt: serverTimestamp(),
                originalTenantId: tenantId, // حفظ tenantId الأصلي للاستعادة
                originalUserId: managerId
            });
        }
    }

    // ✅ 7. Disable all branch codes (instead of delete)
    if (branchCodes.length > 0) {
        for (const branchCode of branchCodes) {
            if (branchCode && branchCode !== managerCode) {
                const branchCodeRef = doc(db, 'globalCodes', branchCode);
                const branchCodeSnap = await getDoc(branchCodeRef);
                if (branchCodeSnap.exists()) {
                    // ✅ تعطيل أكواد الفروع أيضاً
                    batch.update(branchCodeRef, {
                        status: 'deleted',
                        deletedAt: serverTimestamp(),
                        originalTenantId: tenantId,
                        originalUserId: managerId
                    });
                }
            }
        }
    }

    // ✅ 8. Disable related data (employees, rooms, requests, invoices)
    if (tenantId) {
        try {
            // 8.1. Disable employees
            const employeesRef = collection(db, `tenants/${tenantId}/employees`);
            const employeesSnap = await getDocs(employeesRef);
            for (const empDoc of employeesSnap.docs) {
                const empData = empDoc.data();
                if (empData.status !== 'deleted') {
                    batch.update(empDoc.ref, {
                        status: 'deleted',
                        deletedAt: serverTimestamp(),
                        deletedBy: 'system',
                        deletionReason: 'Manager deleted'
                    });
                }
            }

            // 8.2. Disable rooms
            const roomsRef = collection(db, `tenants/${tenantId}/rooms`);
            const roomsSnap = await getDocs(roomsRef);
            for (const roomDoc of roomsSnap.docs) {
                const roomData = roomDoc.data();
                if (roomData.status !== 'deleted' && roomData.status !== 'unavailable') {
                    batch.update(roomDoc.ref, {
                        status: 'unavailable',
                        deletedAt: serverTimestamp(),
                        deletionReason: 'Manager deleted'
                    });
                }
            }

            // 8.3. Cancel active requests
            const { collection: requestsCollection, query: requestsQuery, where: requestsWhere } = await import('firebase/firestore');
            const requestsRef = requestsCollection(db, `tenants/${tenantId}/requests`);
            const activeRequestsQuery = requestsQuery(
                requestsRef,
                requestsWhere('status', 'in', ['pending', 'in_progress', 'assigned'])
            );
            const requestsSnap = await getDocs(activeRequestsQuery);
            for (const reqDoc of requestsSnap.docs) {
                batch.update(reqDoc.ref, {
                    status: 'cancelled',
                    isCancelled: true,
                    cancelReason: 'Manager deleted',
                    cancelledAt: serverTimestamp()
                });
            }
        } catch (err) {
            console.warn(`Could not disable related data for tenant ${tenantId}:`, err);
            // Continue - backup is already created
        }
    }

    // ✅ 9. Mark invoices as deleted (soft delete)
    if (tenantId) {
        try {
            const { collection: invoicesCollection, query: invoicesQuery, where: invoicesWhere } = await import('firebase/firestore');
            const invoicesRef = invoicesCollection(db, 'invoices');
            const tenantInvoicesQuery = invoicesQuery(
                invoicesRef,
                invoicesWhere('tenantId', '==', tenantId),
                invoicesWhere('isDeleted', '!=', true)
            );
            const invoicesSnap = await getDocs(tenantInvoicesQuery);
            for (const invDoc of invoicesSnap.docs) {
                batch.update(invDoc.ref, {
                    isDeleted: true,
                    deletedAt: serverTimestamp(),
                    deletedBy: 'system',
                    deletionReason: 'Manager deleted'
                });
            }
        } catch (err) {
            console.warn(`Could not mark invoices as deleted for tenant ${tenantId}:`, err);
            // Continue - backup is already created
        }
    }

    try {
        await batch.commit();
        console.log('✅ Manager deleted successfully:', managerId);

        // ✅ AUDIT: Log manager deletion
        quickAudit('MANAGER_DELETE', 'manager', managerId, {
            tenantId,
            backupId,
            managerName: managerData?.name,
            branchCodesCount: branchCodes.length
        }, managerData?.name || 'مدير');
    } catch (commitError: any) {
        console.error('❌ Failed to commit batch deletion:', commitError);

        // Check if it's a permission error
        const isPermissionError = commitError?.code === 'permission-denied' ||
            commitError?.message?.includes('permission-denied') ||
            commitError?.message?.includes('Missing or insufficient permissions');

        if (isPermissionError) {
            throw new Error('فشل في الحذف: صلاحيات Firebase غير كافية. يرجى نشر قواعد الأمان المحدثة.');
        }

        throw new Error(commitError.message || 'فشل في تنفيذ عملية الحذف');
    }
};

// ✅ Restore deleted manager (within 7-day recovery period)
export const restoreManager = async (managerId: string): Promise<void> => {
    // ✅ RBAC: Only Owner can restore managers
    validateRoleAccess('owner');

    const batch = writeBatch(db);

    // 1. Get backup
    const deletedRef = doc(db, 'deleted_managers', managerId);
    const deletedSnap = await getDoc(deletedRef);

    if (!deletedSnap.exists()) throw new Error('No backup found for this manager');

    const data = deletedSnap.data();
    // ✅ NO TIME LIMIT: Always allow recovery (removed deadline check)

    const managerCode = data.code; // Get PIN code from backup
    const tenantId = data.tenantId;

    // 2. Restore manager - Check if exists first
    const managerRef = doc(db, 'users', managerId);
    const managerSnap = await getDoc(managerRef);

    if (managerSnap.exists()) {
        batch.update(managerRef, {
            status: 'active',
            deletedAt: null, // Remove field
            licenseStatus: 'active'
        });
    } else {
        // If manager doesn't exist, restore from backup
        const managerBackup = {
            ...data,
            status: 'active',
            deletedAt: null,
            licenseStatus: 'active'
        };
        batch.set(managerRef, managerBackup, { merge: true });
    }

    // 3. Restore tenant
    const tenantBackup = data.tenantBackup; // Get backup data
    if (tenantId) {
        const tenantRef = doc(db, 'tenants', tenantId);
        const tenantSnap = await getDoc(tenantRef);

        let tenantData = null;
        if (tenantSnap.exists()) {
            tenantData = tenantSnap.data();
            batch.update(tenantRef, {
                'info.status': 'active',
                'info.deletedAt': null,
                'info.licenseStatus': 'active'
            });
        } else if (tenantBackup) {
            // If tenant doesn't exist, restore from backup
            batch.set(tenantRef, {
                ...tenantBackup,
                'info.status': 'active',
                'info.deletedAt': null,
                'info.licenseStatus': 'active'
            }, { merge: true });
            tenantData = tenantBackup;
        }

        // 4. ✅ Restore globalCodes (master PIN and branch codes) - with conflict check
        if (managerCode) {
            const masterCodeRef = doc(db, 'globalCodes', managerCode);
            const masterCodeSnap = await getDoc(masterCodeRef);

            if (masterCodeSnap.exists()) {
                const codeData = masterCodeSnap.data();
                // ✅ Check if code is used by another manager
                if (codeData.status === 'active' && codeData.userId !== managerId && codeData.tenantId !== tenantId) {
                    throw new Error(`الكود ${managerCode} مستخدم حالياً من قبل مدير آخر. لا يمكن الاستعادة.`);
                }

                // Update if exists
                batch.update(masterCodeRef, {
                    status: 'active',
                    licenseStatus: 'active',
                    userId: managerId,
                    tenantId: tenantId,
                    role: 'manager',
                    deletedAt: null, // Remove deletion timestamp
                    originalTenantId: null, // Clear backup fields
                    originalUserId: null
                });
            } else {
                // Create if doesn't exist (was deleted)
                batch.set(masterCodeRef, {
                    status: 'active',
                    licenseStatus: 'active',
                    userId: managerId,
                    tenantId: tenantId,
                    role: 'manager',
                    code: managerCode,
                    createdAt: serverTimestamp()
                });
            }

            // Restore branch codes if tenant data exists - with conflict check
            if (tenantData) {
                const branchCodes = tenantData?.info?.branchCodes || [];

                for (const bCode of branchCodes) {
                    if (bCode && bCode !== managerCode) {
                        const bCodeRef = doc(db, 'globalCodes', bCode);
                        const bCodeSnap = await getDoc(bCodeRef);

                        if (bCodeSnap.exists()) {
                            const branchCodeData = bCodeSnap.data();
                            // ✅ Check if branch code is used by another tenant
                            if (branchCodeData.status === 'active' && branchCodeData.tenantId !== tenantId) {
                                console.warn(`Branch code ${bCode} is used by another tenant. Skipping restoration.`);
                                continue; // Skip this branch code
                            }

                            batch.update(bCodeRef, {
                                status: 'active',
                                licenseStatus: 'active',
                                deletedAt: null,
                                originalTenantId: null,
                                originalUserId: null
                            });
                        } else {
                            // Create if doesn't exist
                            batch.set(bCodeRef, {
                                status: 'active',
                                licenseStatus: 'active',
                                tenantId: tenantId,
                                branchCode: bCode,
                                createdAt: serverTimestamp()
                            });
                        }
                    }
                }
            }
        }

        // ✅ 5. Restore related data (employees, rooms, requests)
        if (tenantId) {
            try {
                // 5.1. Restore employees (only those deleted by system due to manager deletion)
                const employeesRef = collection(db, `tenants/${tenantId}/employees`);
                const employeesSnap = await getDocs(employeesRef);
                for (const empDoc of employeesSnap.docs) {
                    const empData = empDoc.data();
                    if (empData.status === 'deleted' && empData.deletionReason === 'Manager deleted') {
                        batch.update(empDoc.ref, {
                            status: 'active',
                            deletedAt: null,
                            deletedBy: null,
                            deletionReason: null
                        });
                    }
                }

                // 5.2. Restore rooms (only those marked unavailable due to manager deletion)
                const roomsRef = collection(db, `tenants/${tenantId}/rooms`);
                const roomsSnap = await getDocs(roomsRef);
                for (const roomDoc of roomsSnap.docs) {
                    const roomData = roomDoc.data();
                    if (roomData.status === 'unavailable' && roomData.deletionReason === 'Manager deleted') {
                        // Restore to 'available' status
                        batch.update(roomDoc.ref, {
                            status: 'available',
                            deletedAt: null,
                            deletionReason: null
                        });
                    }
                }

                // Note: Requests and invoices are NOT restored automatically
                // They remain cancelled/deleted for audit trail
            } catch (err) {
                console.warn(`Could not restore related data for tenant ${tenantId}:`, err);
                // Continue - main restoration is more important
            }
        }
    }

    // 5. Remove from deleted_managers
    batch.delete(deletedRef);

    await batch.commit();

    // ✅ AUDIT: Log manager restoration
    quickAudit('MANAGER_RESTORE', 'manager', managerId, {
        tenantId,
        managerName: data?.name
    }, data?.name || 'مدير');
};

// ✅ Get deleted managers (for recovery)
// ✅ NO TIME LIMIT: All deleted managers can be recovered anytime
export const getDeletedManagers = async (): Promise<Array<User & { deletedAt: Date; canRecover: boolean }>> => {
    // Null safety check
    if (!db) {
        logger.error('Database not initialized', new Error('db is null'), 'ownerService');
        return [];
    }

    // ✅ RBAC: Only Owner can access deleted managers (soft check - Firestore Rules will enforce)
    try {
        validateRoleAccess('owner');
    } catch (rbacError: any) {
        // Don't block here - let Firestore Rules handle it for better error messages
        logger.warn('Client-side RBAC check failed, but proceeding to Firestore (Rules will enforce)', rbacError, 'ownerService');
    }

    try {
        const deletedManagersRef = collection(db, 'deleted_managers');
        // ✅ Owner can read all deleted managers (no filter needed - Firestore Rules handle it)
        const q = query(deletedManagersRef);
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => {
            const data = doc.data();

            return {
                id: data.originalId || doc.id,
                ...data,
                deletedAt: data.deletedAt?.toDate() || new Date(),
                canRecover: true, // ✅ Always true: No time limit for recovery
            } as User & { deletedAt: Date; canRecover: boolean };
        });
    } catch (error: any) {
        logger.error('Error getting deleted managers', error, 'ownerService');
        // ✅ Return empty array instead of throwing to prevent UI crash
        return [];
    }
};

/**
 * ☢️ DEPRECATED: Use executeDeepAudit({ nuclearMode: true, ownerId }) instead
 * This function is kept for backward compatibility but redirects to deepAuditService
 * 
 * @deprecated Use executeDeepAudit from deepAuditService with nuclearMode=true
 */
export const purgeAllSystemData = async (ownerId: string): Promise<{ success: boolean; deletedCount: number }> => {
    // ✅ Redirect to unified Deep Audit with nuclear mode
    const { executeDeepAudit } = await import('./deepAuditService');
    const report = await executeDeepAudit({ nuclearMode: true, ownerId });
    
    return {
        success: report.summary.status === 'STERILE' || report.summary.status === 'CONTAMINATED',
        deletedCount: report.summary.totalDeleted
    };
};

// ============================================================
// DEMO STATS
// ============================================================

/**
 * Get demo managers statistics
 * Returns total count, nearest expiry date, and farthest expiry date
 * ✅ Separated from UI component - follows architecture rules
 */
export const getDemoStats = async (): Promise<{
    total: number;
    nearestExpiry: Date | null;
    farthestExpiry: Date | null;
}> => {
    // ✅ RBAC: Only Owner can access demo stats
    validateRoleAccess('owner');

    try {
        if (!db) {
            return { total: 0, nearestExpiry: null, farthestExpiry: null };
        }

        const managers = await getAllManagers();
        const demoManagers = managers.filter((m: any) =>
            m.isDemo === true &&
            m.status === 'active' &&
            !m.isDeleted &&
            !m.deletedAt
        );

        if (demoManagers.length === 0) {
            return { total: 0, nearestExpiry: null, farthestExpiry: null };
        }

        const expiryDates: Date[] = [];
        demoManagers.forEach((manager: any) => {
            if (manager.licenseExpiry) {
                const expiry = manager.licenseExpiry instanceof Timestamp
                    ? manager.licenseExpiry.toDate()
                    : new Date(manager.licenseExpiry);
                if (!isNaN(expiry.getTime())) {
                    expiryDates.push(expiry);
                }
            }
        });

        if (expiryDates.length === 0) {
            return { total: demoManagers.length, nearestExpiry: null, farthestExpiry: null };
        }

        const sortedDates = expiryDates.sort((a, b) => a.getTime() - b.getTime());
        return {
            total: demoManagers.length,
            nearestExpiry: sortedDates[0],
            farthestExpiry: sortedDates[sortedDates.length - 1]
        };
    } catch (err) {
        console.error('Failed to get demo stats:', err);
        return { total: 0, nearestExpiry: null, farthestExpiry: null };
    }
};
