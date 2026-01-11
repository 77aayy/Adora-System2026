/**
 * Migration Utility
 * Migrate existing single-tenant data to first tenant
 * Adora Hotel Management System V3
 */

import {
    collection,
    doc,
    getDocs,
    writeBatch,
    Timestamp,
    getDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { MigrationResult } from '../types/tenant';

/**
 * Migrate existing data to first tenant
 * WARNING: Run this ONCE during upgrade
 */
export async function migrateToMultiTenant(
    tenantName: string = 'الفندق الرئيسي',
    managerCode: string = '9999'
): Promise<MigrationResult> {

    const result: MigrationResult = {
        success: false,
        employeesMigrated: 0,
        roomsMigrated: 0,
        requestsMigrated: 0,
        errors: []
    };

    try {
        console.log('🚀 Starting migration to multi-tenant...');

        // Step 1: Create first tenant
        const tenantId = `tenant-${Date.now()}`;
        const batch = writeBatch(db);

        const tenantRef = doc(db, 'tenants', tenantId);
        batch.set(tenantRef, {
            info: {
                name: tenantName,
                ownerId: 'manager-initial',
                ownerName: 'المدير',
                plan: 'pro',
                status: 'active',
                createdAt: Timestamp.now(),
                createdBy: 'migration-script'
            }
        });

        console.log('✓ Tenant created:', tenantId);

        // Step 2: Create default branch
        const branchId = 'branch-main';
        const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
        batch.set(branchRef, {
            name: 'الفرع الرئيسي',
            location: '',
            status: 'active',
            createdAt: Timestamp.now()
        });

        console.log('✓ Default branch created');

        // Commit tenant + branch
        await batch.commit();

        // Step 3: Migrate users to employees
        const usersSnap = await getDocs(collection(db, 'users'));
        const employeeBatch = writeBatch(db);
        let empCount = 0;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const employeeRef = doc(db, `tenants/${tenantId}/employees`, userDoc.id);

            employeeBatch.set(employeeRef, {
                tenantId,
                code: userData.code || `temp-${empCount}`,
                name: userData.name,
                department: userData.department || 'reception',
                role: userData.role || 'employee',
                branchId,
                personalPoints: userData.points || 0,
                status: userData.status || 'active',
                createdAt: userData.createdAt || Timestamp.now(),
                createdBy: 'migration'
            });

            // Add to global codes
            const codeRef = doc(db, 'globalCodes', userData.code || `temp-${empCount}`);
            employeeBatch.set(codeRef, {
                tenantId,
                employeeId: userDoc.id,
                role: userData.role === 'manager' ? 'manager' : 'employee',
                department: userData.department,
                createdAt: Timestamp.now()
            });

            empCount++;
        }

        await employeeBatch.commit();
        result.employeesMigrated = empCount;
        console.log(`✓ Migrated ${empCount} employees`);

        // Step 4: Migrate rooms
        const roomsSnap = await getDocs(collection(db, 'rooms'));
        const roomBatch = writeBatch(db);
        let roomCount = 0;

        for (const roomDoc of roomsSnap.docs) {
            const roomData = roomDoc.data();
            const roomRef = doc(db, `tenants/${tenantId}/rooms`, roomDoc.id);

            roomBatch.set(roomRef, {
                ...roomData,
                tenantId,
                branchId,
                createdAt: roomData.createdAt || Timestamp.now()
            });
            roomCount++;
        }

        await roomBatch.commit();
        result.roomsMigrated = roomCount;
        console.log(`✓ Migrated ${roomCount} rooms`);

        // Step 5: Migrate requests
        const requestsSnap = await getDocs(collection(db, 'requests'));
        const reqBatch = writeBatch(db);
        let reqCount = 0;

        for (const reqDoc of requestsSnap.docs) {
            const reqData = reqDoc.data();
            const reqRef = doc(db, `tenants/${tenantId}/requests`, reqDoc.id);

            reqBatch.set(reqRef, {
                ...reqData,
                tenantId,
                branchId
            });
            reqCount++;
        }

        await reqBatch.commit();
        result.requestsMigrated = reqCount;
        console.log(`✓ Migrated ${reqCount} requests`);

        result.success = true;
        result.tenantId = tenantId;

        console.log('✅ Migration complete!');
        console.log('Tenant ID:', tenantId);
        console.log('Manager Code:', managerCode);

        return result;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        return result;
    }
}

/**
 * Verify migration integrity
 */
export async function verifyMigration(tenantId: string): Promise<boolean> {
    try {
        // Check tenant exists
        const tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
        if (!tenantDoc.exists()) {
            console.error('Tenant not found');
            return false;
        }

        // Check employees
        const employeesSnap = await getDocs(collection(db, `tenants/${tenantId}/employees`));
        console.log(`✓ Employees: ${employeesSnap.size}`);

        // Check rooms
        const roomsSnap = await getDocs(collection(db, `tenants/${tenantId}/rooms`));
        console.log(`✓ Rooms: ${roomsSnap.size}`);

        // Check global codes
        const codesSnap = await getDocs(collection(db, 'globalCodes'));
        console.log(`✓ Global codes: ${codesSnap.size}`);

        return true;
    } catch (error) {
        console.error('Verification failed:', error);
        return false;
    }
}
