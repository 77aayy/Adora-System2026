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
    phone: string; // ✅ رقم هاتف المدير (إجباري)
    code: string;
    hotelName?: string; // Optional hotel name for the tenant
    maxBranches?: number; // ✅ License: Maximum number of branches allowed
    branchCodes?: string[]; // ✅ Branch codes assigned to this manager (e.g., ['6', '7', '88', '68'])
    branchNames?: Record<string, string>; // ✅ Branch names mapped by code (e.g., { '6': 'الكورنيش', '7': 'الأندلس' })
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

    // ✅ Calculate license expiry (1 year from now)
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

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
            licenseExpiry: Timestamp.fromDate(oneYearLater), // Expires in 1 year
            licenseStatus: 'active', // 'active' | 'suspended' | 'expired'
            autoRenew: true, // Auto-renew by default
            lastRenewalDate: Timestamp.now(),
            paymentStatus: 'pending', // 'paid' | 'pending' | 'overdue'

            // ✅ Branch Names Map
            branchNames: data.branchNames || {},

            // ✅ Isolated Multi-Tenancy: Custom Firebase config (if provided)
            // When manager logs in, system will use this config instead of master DB
            firebaseConfig: data.firebaseConfig || null,
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
        phone: data.phone, // ✅ رقم هاتف المدير (إجباري)
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
        licenseExpiry: Timestamp.fromDate(oneYearLater),
        licenseStatus: 'active',

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
        phone: data.phone, // ✅ رقم هاتف المدير
        status: 'active',
        role: 'manager',
        department: 'admin',
        licenseExpiry: Timestamp.fromDate(oneYearLater),
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
                licenseExpiry: Timestamp.fromDate(oneYearLater),
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

// ✅ Renew manager license (extend by 1 year)
// Returns warning if price is below default
export const renewLicense = async (
    managerId: string, 
    tenantId: string,
    currentPrice?: number,
    defaultPrice?: number
): Promise<{ warning?: string }> => {
    const batch = writeBatch(db);
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

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
        licenseExpiry: Timestamp.fromDate(oneYearLater),
        licenseStatus: 'active',
        status: 'active',
        'paymentStatus': 'paid'
    });

    // 3. Update tenant license
    const tenantRef = doc(db, 'tenants', tenantId);
    batch.update(tenantRef, {
        'info.licenseExpiry': Timestamp.fromDate(oneYearLater),
        'info.licenseStatus': 'active',
        'info.status': 'active',
        'info.lastRenewalDate': Timestamp.now(),
        'info.paymentStatus': 'paid'
    });

    // 4. ✅ Update globalCodes (master PIN and all branch codes) for login consistency
    if (managerPin) {
        const masterCodeRef = doc(db, 'globalCodes', managerPin);
        batch.update(masterCodeRef, {
            licenseExpiry: Timestamp.fromDate(oneYearLater),
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
                        licenseExpiry: Timestamp.fromDate(oneYearLater),
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
        newExpiryDate: oneYearLater.toISOString(),
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
    const batch = writeBatch(db);

    // ✅ 1. Create automatic backup before deletion
    let backupId: string | null = null;
    if (tenantId) {
        try {
            const { createTenantBackup } = await import('./backupService');
            backupId = await createTenantBackup(tenantId, 'before_delete');
        } catch (err) {
            console.warn('Failed to create backup before deletion:', err);
            // Continue with deletion even if backup fails
        }
    }

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
    if (tenantId) {
        try {
            const tenantRef = doc(db, 'tenants', tenantId);
            const tenantSnap = await getDoc(tenantRef);
            if (tenantSnap.exists()) {
                tenantData = tenantSnap.data();
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

    // 4. Mark manager as deleted (Using SET MERGE for safety)
    batch.set(managerRef, {
        status: 'deleted',
        deletedAt: serverTimestamp()
    }, { merge: true });

    // 5. ✅ Free up the PIN Code (Delete from globalCodes)
    const codeToDelete = managerData?.code;
    if (codeToDelete) {
        const codeRef = doc(db, 'globalCodes', codeToDelete);
        batch.delete(codeRef);
    }

    await batch.commit();
    
    // ✅ AUDIT: Log manager deletion
    quickAudit('MANAGER_DELETE', 'manager', managerId, {
        tenantId,
        backupId,
        managerName: managerData?.name
    }, managerData?.name || 'مدير');
};

// ✅ Restore deleted manager (within 7-day recovery period)
export const restoreManager = async (managerId: string): Promise<void> => {
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

        // 4. ✅ Restore globalCodes (master PIN and branch codes)
        if (managerCode) {
            const masterCodeRef = doc(db, 'globalCodes', managerCode);
            const masterCodeSnap = await getDoc(masterCodeRef);
            
            if (masterCodeSnap.exists()) {
                // Update if exists
                batch.update(masterCodeRef, {
                    status: 'active',
                    licenseStatus: 'active',
                    userId: managerId,
                    tenantId: tenantId,
                    role: 'manager'
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

            // Restore branch codes if tenant data exists
            if (tenantData) {
                const branchCodes = tenantData?.info?.branchCodes || [];
                
                for (const bCode of branchCodes) {
                    if (bCode && bCode !== managerCode) {
                        const bCodeRef = doc(db, 'globalCodes', bCode);
                        const bCodeSnap = await getDoc(bCodeRef);
                        
                        if (bCodeSnap.exists()) {
                            batch.update(bCodeRef, {
                                status: 'active',
                                licenseStatus: 'active'
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
    const deletedManagersRef = collection(db, 'deleted_managers');
    // ✅ Filter by createdBy to satisfy Security Rules
    const q = query(deletedManagersRef, where('createdBy', '==', 'owner'));
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
};

/**
 * ☢️ NUCLEAR OPTION: Purge All System Data (Except Owner)
 * Used to start 'Step 0' testing. Deletes all tenants, branches, managers, employees, and global codes.
 */
export const purgeAllSystemData = async (ownerId: string): Promise<{ success: boolean; deletedCount: number }> => {
    try {
        console.log("☢️ NUCLEAR PURGE INITIATED. Protection: Active.");
        let totalDeleted = 0;

        // --- PHASE 1: Users & Codes ---
        console.log("Phase 1: Protecting Owner & Purging Accounts...");
        try {
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);
            for (const uDoc of usersSnap.docs) {
                const uData = uDoc.data();
                if (uDoc.id !== ownerId && uData.role !== 'owner') {
                    await deleteDoc(uDoc.ref);
                    totalDeleted++;
                } else {
                    console.log("🛡️ Shielded Owner:", uDoc.id);
                }
            }
        } catch (e) { console.error("Users purge error:", e); }

        try {
            const codesRef = collection(db, 'globalCodes');
            const codesSnap = await getDocs(codesRef);
            for (const cDoc of codesSnap.docs) {
                if (cDoc.id !== '765255' && cDoc.id !== '000000') {
                    await deleteDoc(cDoc.ref);
                    totalDeleted++;
                }
            }
        } catch (e) { console.error("Codes purge error:", e); }

        // --- PHASE 2: Tenants ---
        console.log("Phase 2: Vaporizing Tenants & Sub-collections...");
        try {
            const tenantsRef = collection(db, 'tenants');
            const tenantsSnap = await getDocs(tenantsRef);
            for (const tDoc of tenantsSnap.docs) {
                const tenantId = tDoc.id;
                const subCols = ['branches', 'rooms', 'employees', 'teams', 'settings', 'request_history', 'inventory'];
                for (const scName of subCols) {
                    try {
                        const scSnap = await getDocs(collection(db, `tenants/${tenantId}/${scName}`));
                        for (const scDoc of scSnap.docs) {
                            await deleteDoc(scDoc.ref);
                            totalDeleted++;
                        }
                    } catch (e) { /* ignore subcol err */ }
                }
                await deleteDoc(tDoc.ref);
                totalDeleted++;
                console.log(`Vaporized Tenant: ${tenantId}`);
            }
        } catch (e) { console.error("Tenants/Sub purge error:", e); }

        // --- PHASE 3: Archives & Records ---
        console.log("Phase 3: Clearing Archives & History...");
        try {
            const archives = ['deleted_managers', 'audit_logs', 'scheduled_tasks', 'points_history', 'attendance'];
            for (const colName of archives) {
                const snap = await getDocs(collection(db, colName));
                for (const d of snap.docs) {
                    await deleteDoc(d.ref);
                    totalDeleted++;
                }
                console.log(`Cleared ${colName}`);
            }
        } catch (e) { console.error("Archive purge error:", e); }

        // --- PHASE 4: Global Business Data ---
        console.log("Phase 4: Resetting Global Business State...");
        const functionalCollections = [
            'requests', 'roomCards', 'rooms', 'branches', 'inventory',
            'inventory_transactions', 'laundry_records', 'procurement_orders'
        ];

        for (const colName of functionalCollections) {
            try {
                const snap = await getDocs(collection(db, colName));
                for (const d of snap.docs) {
                    await deleteDoc(d.ref);
                    totalDeleted++;
                }
                console.log(`Purged ${colName}`);
            } catch (e) { console.warn(`Could not purge ${colName}:`, e); }
        }

        console.log(`✅ NUCLEAR RESET COMPLETE. Total Records Removed: ${totalDeleted}`);
        return { success: true, deletedCount: totalDeleted };
    } catch (error) {
        console.error('CRITICAL: Purge process failed at base level:', error);
        throw error;
    }
};
