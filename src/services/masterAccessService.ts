/**
 * Master Access Service
 * Allows Super Admin to access and fix any tenant's data
 * 
 * ⚠️ SECURITY: Only accessible by owner/super-admin role
 * 
 * Use cases:
 * - Fix wrong Firebase credentials entered by tenant
 * - Reset tenant configuration
 * - Access tenant data for support
 * - Emergency account recovery
 * 
 * Adora Hotel Management System V3
 */

import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    getDocs, 
    query, 
    where,
    deleteDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface TenantInfo {
    id: string;
    name: string;
    hotelName?: string;
    ownerCode: string;
    status: 'active' | 'suspended' | 'deleted';
    firebaseConfig?: {
        apiKey?: string;
        projectId?: string;
        authDomain?: string;
        storageBucket?: string;
        appId?: string;
    };
    createdAt: Date;
    updatedAt?: Date;
    branches: string[];
}

export interface TenantFixResult {
    success: boolean;
    message: string;
    details?: any;
}

// ============================================================
// AUTHORIZATION CHECK
// ============================================================

/**
 * Check if user has master access (owner/super-admin)
 */
export const hasMasterAccess = async (userId: string): Promise<boolean> => {
    if (!userId || !db) return false;
    
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return false;
        
        const userData = userDoc.data();
        return userData?.role === 'owner' || userData?.role === 'super-admin';
    } catch (error) {
        logger.error('Master access check failed:', error, 'masterAccessService');
        return false;
    }
};

// ============================================================
// TENANT MANAGEMENT
// ============================================================

/**
 * Get all tenants (for master overview)
 */
export const getAllTenants = async (adminUserId: string): Promise<TenantInfo[]> => {
    if (!await hasMasterAccess(adminUserId)) {
        throw new Error('غير مصرح لك بالوصول لهذه البيانات');
    }
    
    const tenantsSnap = await getDocs(collection(db!, 'tenants'));
    const tenants: TenantInfo[] = [];
    
    for (const tenantDoc of tenantsSnap.docs) {
        const infoDoc = await getDoc(doc(db!, `tenants/${tenantDoc.id}/info`));
        const infoData = infoDoc.exists() ? infoDoc.data() : {};
        
        tenants.push({
            id: tenantDoc.id,
            name: infoData.name || tenantDoc.id,
            hotelName: infoData.hotelName,
            ownerCode: infoData.ownerCode || '',
            status: infoData.status || 'active',
            firebaseConfig: infoData.firebaseConfig,
            createdAt: infoData.createdAt?.toDate?.() || new Date(),
            updatedAt: infoData.updatedAt?.toDate?.(),
            branches: infoData.branchCodes || []
        });
    }
    
    return tenants;
};

/**
 * Get specific tenant details
 */
export const getTenantDetails = async (
    adminUserId: string, 
    tenantId: string
): Promise<TenantInfo | null> => {
    if (!await hasMasterAccess(adminUserId)) {
        throw new Error('غير مصرح لك بالوصول لهذه البيانات');
    }
    
    const infoDoc = await getDoc(doc(db!, `tenants/${tenantId}/info`));
    if (!infoDoc.exists()) return null;
    
    const data = infoDoc.data();
    return {
        id: tenantId,
        name: data.name || tenantId,
        hotelName: data.hotelName,
        ownerCode: data.ownerCode || '',
        status: data.status || 'active',
        firebaseConfig: data.firebaseConfig,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.(),
        branches: data.branchCodes || []
    };
};

// ============================================================
// FIREBASE CONFIG FIXES
// ============================================================

/**
 * Fix tenant's Firebase configuration
 * Use when tenant entered wrong credentials and can't access their account
 */
export const fixTenantFirebaseConfig = async (
    adminUserId: string,
    tenantId: string,
    newConfig: {
        apiKey?: string;
        projectId?: string;
        authDomain?: string;
        storageBucket?: string;
        appId?: string;
    }
): Promise<TenantFixResult> => {
    if (!await hasMasterAccess(adminUserId)) {
        return { success: false, message: 'غير مصرح لك بالوصول' };
    }
    
    try {
        const tenantInfoRef = doc(db!, `tenants/${tenantId}/info`);
        const currentDoc = await getDoc(tenantInfoRef);
        
        if (!currentDoc.exists()) {
            return { success: false, message: 'المستأجر غير موجود' };
        }
        
        // Build updated config (preserve existing values if not provided)
        const currentConfig = currentDoc.data()?.firebaseConfig || {};
        const updatedConfig = {
            ...currentConfig,
            ...Object.fromEntries(
                Object.entries(newConfig).filter(([_, v]) => v !== undefined && v !== '')
            )
        };
        
        await updateDoc(tenantInfoRef, {
            firebaseConfig: updatedConfig,
            updatedAt: serverTimestamp(),
            lastFixedBy: adminUserId,
            lastFixedAt: serverTimestamp()
        });
        
        // Log the fix action
        await addAuditLog(adminUserId, tenantId, 'firebase_config_fixed', {
            projectId: updatedConfig.projectId
        });
        
        return {
            success: true,
            message: '✅ تم تحديث إعدادات Firebase بنجاح',
            details: { projectId: updatedConfig.projectId }
        };
    } catch (error: any) {
        logger.error('Fix Firebase config error:', error, 'masterAccessService');
        return { success: false, message: `❌ فشل التحديث: ${error.message}` };
    }
};

/**
 * Clear tenant's Firebase configuration (reset to use main project)
 */
export const clearTenantFirebaseConfig = async (
    adminUserId: string,
    tenantId: string
): Promise<TenantFixResult> => {
    if (!await hasMasterAccess(adminUserId)) {
        return { success: false, message: 'غير مصرح لك بالوصول' };
    }
    
    try {
        const tenantInfoRef = doc(db!, `tenants/${tenantId}/info`);
        
        await updateDoc(tenantInfoRef, {
            firebaseConfig: null,
            updatedAt: serverTimestamp(),
            lastFixedBy: adminUserId,
            lastFixedAt: serverTimestamp()
        });
        
        // Log the action
        await addAuditLog(adminUserId, tenantId, 'firebase_config_cleared', {});
        
        return {
            success: true,
            message: '✅ تم مسح إعدادات Firebase - سيستخدم المشروع الرئيسي الآن'
        };
    } catch (error: any) {
        return { success: false, message: `❌ فشل المسح: ${error.message}` };
    }
};

// ============================================================
// ACCOUNT RECOVERY
// ============================================================

/**
 * Reset tenant's access code (emergency recovery)
 */
export const resetTenantAccessCode = async (
    adminUserId: string,
    tenantId: string,
    newCode: string
): Promise<TenantFixResult> => {
    if (!await hasMasterAccess(adminUserId)) {
        return { success: false, message: 'غير مصرح لك بالوصول' };
    }
    
    if (!newCode || newCode.length !== 4 || !/^\d+$/.test(newCode)) {
        return { success: false, message: 'الكود يجب أن يكون 4 أرقام' };
    }
    
    try {
        // Check if code is available
        const globalCodeRef = doc(db!, 'globalCodes', newCode);
        const existingCode = await getDoc(globalCodeRef);
        
        if (existingCode.exists()) {
            const existingData = existingCode.data();
            if (existingData.tenantId !== tenantId) {
                return { success: false, message: 'الكود مستخدم بالفعل من مستأجر آخر' };
            }
        }
        
        // Get current tenant info
        const tenantInfoRef = doc(db!, `tenants/${tenantId}/info`);
        const tenantInfo = await getDoc(tenantInfoRef);
        const oldCode = tenantInfo.data()?.ownerCode;
        
        // Remove old code
        if (oldCode && oldCode !== newCode) {
            await deleteDoc(doc(db!, 'globalCodes', oldCode));
        }
        
        // Register new code
        await setDoc(globalCodeRef, {
            tenantId,
            type: 'manager',
            createdAt: serverTimestamp()
        });
        
        // Update tenant info
        await updateDoc(tenantInfoRef, {
            ownerCode: newCode,
            updatedAt: serverTimestamp(),
            lastFixedBy: adminUserId
        });
        
        // Update manager user document
        const managersQuery = query(
            collection(db!, 'users'),
            where('tenantId', '==', tenantId),
            where('role', '==', 'manager')
        );
        const managers = await getDocs(managersQuery);
        
        for (const managerDoc of managers.docs) {
            await updateDoc(managerDoc.ref, { code: newCode });
        }
        
        // Log the action
        await addAuditLog(adminUserId, tenantId, 'access_code_reset', {
            oldCode: oldCode ? '****' : null,
            newCode: '****'
        });
        
        return {
            success: true,
            message: `✅ تم تغيير كود المدير إلى ${newCode}`,
            details: { newCode }
        };
    } catch (error: any) {
        return { success: false, message: `❌ فشل التغيير: ${error.message}` };
    }
};

/**
 * Reactivate suspended/deleted tenant
 */
export const reactivateTenant = async (
    adminUserId: string,
    tenantId: string
): Promise<TenantFixResult> => {
    if (!await hasMasterAccess(adminUserId)) {
        return { success: false, message: 'غير مصرح لك بالوصول' };
    }
    
    try {
        const tenantInfoRef = doc(db!, `tenants/${tenantId}/info`);
        
        await updateDoc(tenantInfoRef, {
            status: 'active',
            suspendedAt: null,
            deletedAt: null,
            reactivatedBy: adminUserId,
            reactivatedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Reactivate manager user
        const managersQuery = query(
            collection(db!, 'users'),
            where('tenantId', '==', tenantId),
            where('role', '==', 'manager')
        );
        const managers = await getDocs(managersQuery);
        
        for (const managerDoc of managers.docs) {
            await updateDoc(managerDoc.ref, { 
                status: 'active',
                isActive: true
            });
        }
        
        // Log the action
        await addAuditLog(adminUserId, tenantId, 'tenant_reactivated', {});
        
        return {
            success: true,
            message: '✅ تم إعادة تفعيل الحساب بنجاح'
        };
    } catch (error: any) {
        return { success: false, message: `❌ فشل التفعيل: ${error.message}` };
    }
};

// ============================================================
// DATA ACCESS
// ============================================================

/**
 * View tenant's data (read-only for support)
 */
export const viewTenantData = async (
    adminUserId: string,
    tenantId: string,
    collectionName: string,
    limit: number = 50
): Promise<any[]> => {
    if (!await hasMasterAccess(adminUserId)) {
        throw new Error('غير مصرح لك بالوصول');
    }
    
    const { getDocs, collection: col, query: q, limit: lim } = await import('firebase/firestore');
    
    const dataQuery = q(
        col(db!, `tenants/${tenantId}/${collectionName}`),
        lim(limit)
    );
    
    const snapshot = await getDocs(dataQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// ============================================================
// AUDIT LOGGING
// ============================================================

/**
 * Add audit log for master access actions
 */
const addAuditLog = async (
    adminUserId: string,
    tenantId: string,
    action: string,
    details: any
): Promise<void> => {
    try {
        await setDoc(doc(collection(db!, 'master_access_logs')), {
            adminUserId,
            tenantId,
            action,
            details,
            timestamp: serverTimestamp(),
            ip: 'server-side' // In production, get real IP
        });
    } catch (e) {
        logger.warn('Audit log failed:', e, 'masterAccessService');
    }
};

/**
 * Get master access audit logs
 */
export const getMasterAccessLogs = async (
    adminUserId: string,
    tenantId?: string,
    limit: number = 100
): Promise<any[]> => {
    if (!await hasMasterAccess(adminUserId)) {
        throw new Error('غير مصرح لك بالوصول');
    }
    
    let logsQuery;
    if (tenantId) {
        logsQuery = query(
            collection(db!, 'master_access_logs'),
            where('tenantId', '==', tenantId)
        );
    } else {
        logsQuery = collection(db!, 'master_access_logs');
    }
    
    const snapshot = await getDocs(logsQuery);
    return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
        .slice(0, limit);
};

export default {
    hasMasterAccess,
    getAllTenants,
    getTenantDetails,
    fixTenantFirebaseConfig,
    clearTenantFirebaseConfig,
    resetTenantAccessCode,
    reactivateTenant,
    viewTenantData,
    getMasterAccessLogs
};
