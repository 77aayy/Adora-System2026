/**
 * Firebase Tenant Repository Implementation
 * Implements ITenantRepository using Firebase/Firestore
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @description
 * This implementation wraps the existing ownerService functions
 * to provide the ITenantRepository interface. Handles:
 * - Tenant (hotel) management
 * - Manager creation and lifecycle
 * - Branch management
 * - License management
 * - PIN management
 */

import { 
    ITenantRepository, 
    CreateManagerData, 
    CreateManagerResult, 
    CreateBranchData 
} from '../interfaces/ITenantRepository';
import { Tenant, Branch, Employee } from '../../types/tenant';
import {
    createManager as firebaseCreateManager,
    getAllManagers as firebaseGetAllManagers,
    isPinAvailable as firebaseIsPinAvailable,
    suggestUniquePin as firebaseSuggestUniquePin
} from '../../services/ownerService';
import { 
    doc, 
    getDoc, 
    getDocs, 
    collection, 
    query, 
    where, 
    updateDoc,
    setDoc,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';

/**
 * Firebase implementation of ITenantRepository
 * 
 * @example
 * ```typescript
 * const tenantRepo = new FirebaseTenantRepository();
 * const result = await tenantRepo.createManager({
 *   name: 'محمد',
 *   phone: '0501234567',
 *   code: '1234',
 *   hotelName: 'فندق الرياض'
 * });
 * ```
 */
export class FirebaseTenantRepository implements ITenantRepository {
    // ============================================================
    // TENANT MANAGEMENT
    // ============================================================

    async getTenant(tenantId: string): Promise<Tenant | null> {
        try {
            const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
            if (!tenantDoc.exists()) return null;
            return { id: tenantDoc.id, ...tenantDoc.data() } as Tenant;
        } catch (error) {
            console.error('Error getting tenant:', error);
            return null;
        }
    }

    async getAllTenants(): Promise<Tenant[]> {
        try {
            const snapshot = await getDocs(collection(db, 'tenants'));
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Tenant[];
        } catch (error) {
            console.error('Error getting all tenants:', error);
            return [];
        }
    }

    async updateTenant(tenantId: string, data: Partial<Tenant>): Promise<void> {
        const tenantRef = doc(db, 'tenants', tenantId);
        await updateDoc(tenantRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }

    // ============================================================
    // MANAGER MANAGEMENT
    // ============================================================

    async createManager(data: CreateManagerData): Promise<CreateManagerResult> {
        return firebaseCreateManager(data);
    }

    async getAllManagers(): Promise<any[]> {
        return firebaseGetAllManagers();
    }

    async suspendManager(managerId: string): Promise<void> {
        const userRef = doc(db, 'users', managerId);
        await updateDoc(userRef, {
            status: 'suspended',
            suspendedAt: serverTimestamp()
        });
    }

    async reactivateManager(managerId: string): Promise<void> {
        const userRef = doc(db, 'users', managerId);
        await updateDoc(userRef, {
            status: 'active',
            reactivatedAt: serverTimestamp()
        });
    }

    async deleteManager(managerId: string): Promise<void> {
        const userRef = doc(db, 'users', managerId);
        await updateDoc(userRef, {
            status: 'deleted',
            deletedAt: serverTimestamp()
        });
    }

    // ============================================================
    // BRANCH MANAGEMENT
    // ============================================================

    async getBranches(tenantId: string): Promise<Branch[]> {
        try {
            const snapshot = await getDocs(
                collection(db, `tenants/${tenantId}/branches`)
            );
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Branch[];
        } catch (error) {
            console.error('Error getting branches:', error);
            return [];
        }
    }

    async createBranch(data: CreateBranchData): Promise<string> {
        const branchId = `branch-${data.code}`;
        const branchRef = doc(db, `tenants/${data.tenantId}/branches`, branchId);
        
        await setDoc(branchRef, {
            code: data.code,
            name: data.name,
            status: 'active',
            createdBy: data.createdBy,
            createdAt: serverTimestamp()
        });

        return branchId;
    }

    async updateBranch(
        tenantId: string,
        branchId: string,
        data: Partial<Branch>
    ): Promise<void> {
        const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
        await updateDoc(branchRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }

    async deleteBranch(tenantId: string, branchId: string): Promise<void> {
        const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
        await updateDoc(branchRef, {
            status: 'scheduled_for_deletion',
            deletedAt: serverTimestamp()
        });
    }

    // ============================================================
    // EMPLOYEE MANAGEMENT
    // ============================================================

    async getEmployees(tenantId: string, branchId?: string): Promise<Employee[]> {
        try {
            let q = collection(db, `tenants/${tenantId}/employees`);
            
            if (branchId) {
                const constraints = [where('branchId', '==', branchId)];
                const qWithFilter = query(q, ...constraints);
                const snapshot = await getDocs(qWithFilter);
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Employee[];
            }

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Employee[];
        } catch (error) {
            console.error('Error getting employees:', error);
            return [];
        }
    }

    async createTenantEmployee(
        tenantId: string,
        data: Omit<Employee, 'id' | 'createdAt'>
    ): Promise<string> {
        const employeeId = `${data.department}-${Date.now()}`;
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, employeeId);
        
        await setDoc(employeeRef, {
            ...data,
            id: employeeId,
            createdAt: serverTimestamp()
        });

        return employeeId;
    }

    async updateEmployee(
        tenantId: string,
        employeeId: string,
        data: Partial<Employee>
    ): Promise<void> {
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, employeeId);
        await updateDoc(employeeRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    }

    // ============================================================
    // LICENSE MANAGEMENT
    // ============================================================

    async extendLicense(managerId: string, months: number): Promise<void> {
        const userRef = doc(db, 'users', managerId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
            throw new Error('Manager not found');
        }

        const currentExpiry = userDoc.data().licenseExpiryDate?.toDate() || new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setMonth(newExpiry.getMonth() + months);

        await updateDoc(userRef, {
            licenseExpiryDate: Timestamp.fromDate(newExpiry),
            licenseStatus: 'active',
            updatedAt: serverTimestamp()
        });
    }

    async getExpiringLicenses(daysThreshold: number): Promise<any[]> {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        const q = query(
            collection(db, 'users'),
            where('role', '==', 'manager'),
            where('status', '==', 'active'),
            where('licenseExpiryDate', '<=', Timestamp.fromDate(thresholdDate))
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    }

    // ============================================================
    // PIN MANAGEMENT
    // ============================================================

    async isPinAvailable(pin: string): Promise<boolean> {
        return firebaseIsPinAvailable(pin);
    }

    async suggestUniquePin(): Promise<string> {
        return firebaseSuggestUniquePin();
    }
}

/**
 * Singleton instance for convenience
 */
export const tenantRepository = new FirebaseTenantRepository();
