/**
 * 🧪 Create Test Tenant Script
 * إنشاء tenant تجريبي للاختبار
 * 
 * Usage:
 * import { createTestTenant } from '@/utils/createTestTenant';
 * await createTestTenant();
 */

import { db } from '../services/firebase';
import { doc, setDoc, collection, addDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { seedTenantDatabase } from '../services/tenantSeedingService';
import { setFeatureFlags } from '../services/featureFlagsService';

// ============================================================
// CREATE TEST TENANT
// ============================================================

export interface TestTenantResult {
    success: boolean;
    tenantId: string;
    managerId: string;
    managerCode: string;
    errors: string[];
}

/**
 * Create a test tenant with demo data for testing
 */
export async function createTestTenant(): Promise<TestTenantResult> {
    const result: TestTenantResult = {
        success: false,
        tenantId: '',
        managerId: '',
        managerCode: '9999',
        errors: []
    };

    if (!db) {
        result.errors.push('Firebase not initialized');
        return result;
    }

    try {
        console.log('🧪 Creating test tenant...');

        const tenantId = `test-tenant-${Date.now()}`;
        const managerId = `test-manager-${Date.now()}`;
        const managerCode = '9999';
        const hotelName = 'فندق تجريبي للاختبار';

        const batch = writeBatch(db);
        const now = Timestamp.now();
        const expiryDate = new Date(now.toDate());
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        // 1. Create tenant
        const tenantRef = doc(db, 'tenants', tenantId);
        batch.set(tenantRef, {
            info: {
                name: hotelName,
                ownerId: managerId,
                ownerName: 'مدير تجريبي',
                plan: 'pro',
                status: 'active',
                createdAt: now,
                createdBy: 'test-script',
                maxBranches: 1,
                branchCodes: [managerCode],
                licenseExpiry: Timestamp.fromDate(expiryDate),
                licenseStatus: 'active',
                autoRenew: false,
                lastRenewalDate: now,
                paymentStatus: 'paid',
                isDemo: true,
                branchNames: { [managerCode]: 'الفرع الرئيسي' }
            }
        });

        // 2. Create default branch
        const branchRef = doc(db, `tenants/${tenantId}/branches`, 'branch-main');
        batch.set(branchRef, {
            name: 'الفرع الرئيسي',
            code: managerCode,
            location: '',
            status: 'active',
            createdAt: now
        });

        // 3. Create manager user
        const managerRef = doc(db, 'users', managerId);
        batch.set(managerRef, {
            id: managerId,
            name: 'مدير تجريبي',
            code: managerCode,
            role: 'manager',
            tenantId: tenantId,
            branchId: 'branch-main',
            branch: 'branch-main',
            status: 'active',
            createdAt: now,
            isTest: true
        });

        // 4. Create manager in employees collection (for tenant isolation)
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, managerId);
        batch.set(employeeRef, {
            id: managerId,
            name: 'مدير تجريبي',
            code: managerCode,
            role: 'manager',
            branchId: 'branch-main',
            branch: 'branch-main',
            status: 'active',
            createdAt: now,
            currentPoints: 0,
            lifetimePoints: 0,
            isTest: true
        });

        // Commit batch
        await batch.commit();
        console.log(`✅ Tenant created: ${tenantId}`);

        // 5. Seed tenant database
        console.log('🌱 Seeding tenant database...');
        const seedResult = await seedTenantDatabase(tenantId, {
            forceReseed: false,
            includeDemoRoom: true
        });

        if (!seedResult.success) {
            result.errors.push(...seedResult.errors);
            console.warn('⚠️ Seeding completed with errors:', seedResult.errors);
        } else {
            console.log(`✅ Seeding complete: ${seedResult.totalDocuments} documents created`);
        }

        // 6. Enable Universal Action Card for testing
        console.log('🚩 Setting feature flags...');
        try {
            await setFeatureFlags(tenantId, {
                useUniversalActionCard: true,
                useUnifiedStateMachine: true,
                useUniversalCardInHousekeeping: true,
                rolloutPercentage: 100
            });
            console.log('✅ Feature flags enabled');
        } catch (err: any) {
            result.errors.push(`Feature flags: ${err.message}`);
            console.warn('⚠️ Failed to set feature flags:', err);
        }

        // 7. Create test employees (for realistic testing)
        console.log('👥 Creating test employees...');
        try {
            const testEmployees = [
                { id: 'emp-1', name: 'موظف النظافة', code: '1001', department: 'housekeeping', role: 'employee' },
                { id: 'emp-2', name: 'موظف الصيانة', code: '1002', department: 'maintenance', role: 'employee' },
                { id: 'emp-3', name: 'موظف الاستقبال', code: '1003', department: 'reception', role: 'employee' },
                { id: 'emp-4', name: 'موظف البيلمان', code: '1004', department: 'bellman', role: 'employee' }
            ];
            
            const empBatch = writeBatch(db);
            for (const emp of testEmployees) {
                // In users collection
                const userRef = doc(db, 'users', emp.id);
                empBatch.set(userRef, {
                    id: emp.id,
                    name: emp.name,
                    code: emp.code,
                    role: emp.role,
                    department: emp.department,
                    tenantId: tenantId,
                    branchId: 'branch-main',
                    branch: 'branch-main',
                    status: 'active',
                    createdAt: now,
                    currentPoints: 0,
                    lifetimePoints: 0,
                    isTest: true
                });
                
                // In employees collection (tenant-scoped)
                const employeeRef = doc(db, `tenants/${tenantId}/employees`, emp.id);
                empBatch.set(employeeRef, {
                    id: emp.id,
                    name: emp.name,
                    code: emp.code,
                    role: emp.role,
                    department: emp.department,
                    branchId: 'branch-main',
                    branch: 'branch-main',
                    status: 'active',
                    createdAt: now,
                    currentPoints: 0,
                    lifetimePoints: 0,
                    isTest: true
                });
            }
            await empBatch.commit();
            console.log(`✅ ${testEmployees.length} test employees created`);
        } catch (err: any) {
            result.errors.push(`Test employees: ${err.message}`);
            console.warn('⚠️ Failed to create test employees:', err);
        }

        // 8. Create multiple test rooms (for realistic testing)
        console.log('🏨 Creating test rooms...');
        try {
            const testRooms = [
                { number: '101', floor: 1, status: 'dirty', type: 'standard' },
                { number: '102', floor: 1, status: 'clean', type: 'standard' },
                { number: '201', floor: 2, status: 'dirty', type: 'suite' },
                { number: '202', floor: 2, status: 'clean', type: 'standard' },
                { number: '301', floor: 3, status: 'maintenance', type: 'deluxe' }
            ];
            
            const roomsBatch = writeBatch(db);
            for (const room of testRooms) {
                const roomRef = doc(db, `tenants/${tenantId}/rooms`, room.number);
                roomsBatch.set(roomRef, {
                    number: room.number,
                    floor: room.floor,
                    status: room.status,
                    type: room.type,
                    branchId: 'branch-main',
                    branch: 'branch-main',
                    tenantId: tenantId,
                    createdAt: now,
                    isTest: true
                });
            }
            await roomsBatch.commit();
            console.log(`✅ ${testRooms.length} test rooms created`);
        } catch (err: any) {
            result.errors.push(`Test rooms: ${err.message}`);
            console.warn('⚠️ Failed to create test rooms:', err);
        }

        // 9. Create multiple test requests (for realistic testing)
        console.log('📝 Creating test requests...');
        try {
            const testRequests: Array<{
                type: string;
                status: string;
                roomNumber: string;
                guestName: string;
                priority: string;
                currentDepartment: string;
                targetStatus: 'NEW' | 'IN_PROGRESS' | 'COMPLETED';
            }> = [
                {
                    type: 'cleaning',
                    status: 'CONFIRMED',
                    roomNumber: '101',
                    guestName: 'نزيل تجريبي 1',
                    priority: 'normal',
                    currentDepartment: 'housekeeping',
                    targetStatus: 'NEW'
                },
                {
                    type: 'cleaning',
                    status: 'IN_PROGRESS',
                    roomNumber: '102',
                    guestName: 'نزيل تجريبي 2',
                    priority: 'urgent',
                    currentDepartment: 'housekeeping',
                    targetStatus: 'IN_PROGRESS'
                },
                {
                    type: 'maintenance',
                    status: 'CONFIRMED',
                    roomNumber: '201',
                    guestName: 'نزيل تجريبي 3',
                    priority: 'normal',
                    currentDepartment: 'maintenance',
                    targetStatus: 'NEW'
                },
                {
                    type: 'bellman',
                    status: 'IN_PROGRESS',
                    roomNumber: '202',
                    guestName: 'نزيل تجريبي 4',
                    priority: 'normal',
                    currentDepartment: 'bellman',
                    targetStatus: 'IN_PROGRESS'
                }
            ];
            
            const requestsBatch = writeBatch(db);
            for (const req of testRequests) {
                const requestId = `test-req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const requestRef = doc(db, `tenants/${tenantId}/requests`, requestId);
                
                requestsBatch.set(requestRef, {
                    id: requestId,
                    type: req.type,
                    status: req.status,
                    priority: req.priority,
                    source: 'reception',
                    roomNumber: req.roomNumber,
                    guestName: req.guestName,
                    branch: 'branch-main',
                    tenantId: tenantId,
                    createdBy: {
                        id: managerId,
                        name: 'مدير تجريبي',
                        department: 'reception'
                    },
                    createdAt: Timestamp.fromMillis(now.toMillis() - Math.random() * 3600000), // Random time in last hour
                    currentDepartment: req.currentDepartment,
                    originDepartment: 'reception',
                    involvedDepartments: ['reception', req.currentDepartment],
                    isActionRequiredByReception: req.targetStatus === 'COMPLETED',
                    stateHistory: [{
                        fromStatus: 'NEW' as const,
                        toStatus: req.targetStatus,
                        fromDepartment: 'reception',
                        toDepartment: req.currentDepartment,
                        userId: managerId,
                        userName: 'مدير تجريبي',
                        timestamp: now,
                        notes: `طلب تجريبي - ${req.type}`
                    }],
                    isTest: true
                });
            }
            await requestsBatch.commit();
            console.log(`✅ ${testRequests.length} test requests created`);
        } catch (err: any) {
            result.errors.push(`Test requests: ${err.message}`);
            console.warn('⚠️ Failed to create test requests:', err);
        }

        result.success = true;
        result.tenantId = tenantId;
        result.managerId = managerId;
        result.managerCode = managerCode;

        console.log(`
✅ Test tenant created successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tenant ID: ${tenantId}
Manager ID: ${managerId}
Manager Code: ${managerCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Login with:
- Code: ${managerCode}
- Employee Code: ${managerCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

        return result;

    } catch (error: any) {
        result.errors.push(error.message || 'Unknown error');
        console.error('❌ Error creating test tenant:', error);
        return result;
    }
}

/**
 * Quick test: Create tenant and log result
 */
export async function quickTest(): Promise<void> {
    const result = await createTestTenant();
    if (result.success) {
        console.log('✅ Test tenant ready!');
        console.log(`Login with code: ${result.managerCode}`);
    } else {
        console.error('❌ Failed to create test tenant:', result.errors);
    }
}
