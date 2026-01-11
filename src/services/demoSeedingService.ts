/**
 * 🎭 Demo Seeding Service
 * ========================
 * يُنشئ بيانات تجريبية للعرض التسويقي
 * يملأ النظام بـ: فندق + غرف + موظفين + طلبات
 * 
 * @usage
 * import { seedDemoData, clearDemoData } from './demoSeedingService';
 * await seedDemoData(tenantId);
 */

import { db } from './firebase';
import {
    collection, doc, setDoc, addDoc, writeBatch, Timestamp, serverTimestamp, getDocs, query, where, deleteDoc
} from 'firebase/firestore';
import { logger } from './loggerService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DemoSeedResult {
    success: boolean;
    branchId?: string;
    roomsCreated: number;
    employeesCreated: number;
    requestsCreated: number;
    error?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEMO DATA TEMPLATES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEMO_BRANCH = {
    code: '01',
    name: 'فندق أدورا التجريبي',
    address: 'الرياض، المملكة العربية السعودية',
    phone: '+966500000000',
    status: 'active',
    location: {
        latitude: 24.7136,
        longitude: 46.6753,
        radius: 500
    },
    settings: {
        allowGuestRequests: true,
        requireLocationVerification: false,
        maxRoomsPerFloor: 20,
        // ✨ إعدادات الـ Overflow
        taskLimits: {
            bellman: 3,
            housekeeping: 5,
            maintenance: 4
        }
    }
};

const DEMO_ROOMS = [
    // 6 غرف مسكنة (occupied)
    { number: '101', floor: 1, type: 'single', status: 'occupied', guestName: 'أحمد محمد' },
    { number: '102', floor: 1, type: 'double', status: 'occupied', guestName: 'خالد العتيبي' },
    { number: '103', floor: 1, type: 'suite', status: 'occupied', guestName: 'فاطمة السعيد' },
    { number: '201', floor: 2, type: 'double', status: 'occupied', guestName: 'عبدالله القحطاني' },
    { number: '202', floor: 2, type: 'single', status: 'occupied', guestName: 'سارة الدوسري' },
    { number: '203', floor: 2, type: 'presidential', status: 'occupied', guestName: 'محمد الشهري' },
    // 2 غرف تحتاج تنظيف (cleaning)
    { number: '104', floor: 1, type: 'single', status: 'cleaning', guestName: null },
    { number: '204', floor: 2, type: 'double', status: 'cleaning', guestName: null },
    // 2 غرف صيانة (maintenance)
    { number: '105', floor: 1, type: 'double', status: 'maintenance', guestName: null },
    { number: '205', floor: 2, type: 'suite', status: 'maintenance', guestName: null },
];

const DEMO_EMPLOYEES = [
    // الأقسام الخمسة
    { name: 'سعود البيلمان', code: '1001', department: 'bellman', role: 'employee' },
    { name: 'نورة النظافة', code: '1002', department: 'housekeeping', role: 'employee' },
    { name: 'فهد الصيانة', code: '1003', department: 'maintenance', role: 'employee' },
    { name: 'ريم الاستقبال', code: '1004', department: 'reception', role: 'employee' },
    { name: 'ياسر الكافيه', code: '1005', department: 'coffeeshop', role: 'employee' },
];

const DEMO_REQUESTS = [
    // 2 طلب "قيد التنفيذ" (للـ Overflow)
    {
        type: 'bellman',
        status: 'IN_PROGRESS',
        priority: 'high',
        roomNumber: '101',
        guestName: 'أحمد محمد',
        title: 'نقل أمتعة',
        description: 'نقل حقائب من الاستقبال للغرفة',
        createdMinutesAgo: 15,
    },
    {
        type: 'bellman',
        status: 'IN_PROGRESS',
        priority: 'normal',
        roomNumber: '201',
        guestName: 'عبدالله القحطاني',
        title: 'طلب تاكسي',
        description: 'ترتيب سيارة أجرة للمطار',
        createdMinutesAgo: 10,
    },
    // 3 طلب "مكتمل" (للتقارير)
    {
        type: 'cleaning',
        status: 'COMPLETED',
        priority: 'normal',
        roomNumber: '102',
        guestName: 'خالد العتيبي',
        title: 'تنظيف يومي',
        description: 'تنظيف روتيني للغرفة',
        createdMinutesAgo: 120,
        completedMinutesAgo: 60,
        rating: 5,
    },
    {
        type: 'maintenance',
        status: 'COMPLETED',
        priority: 'high',
        roomNumber: '103',
        guestName: 'فاطمة السعيد',
        title: 'إصلاح تكييف',
        description: 'التكييف لا يعمل بشكل صحيح',
        createdMinutesAgo: 180,
        completedMinutesAgo: 90,
        rating: 4,
    },
    {
        type: 'amenities',
        status: 'COMPLETED',
        priority: 'low',
        roomNumber: '202',
        guestName: 'سارة الدوسري',
        title: 'مستلزمات إضافية',
        description: 'طلب مناشف إضافية',
        createdMinutesAgo: 240,
        completedMinutesAgo: 200,
        rating: 5,
    },
    // 1 طلب "متأخر" (للتنبيه الأحمر)
    {
        type: 'cleaning',
        status: 'CONFIRMED',
        priority: 'urgent',
        roomNumber: '203',
        guestName: 'محمد الشهري',
        title: 'تنظيف عاجل - VIP',
        description: 'نزيل VIP يطلب تنظيف فوري',
        createdMinutesAgo: 45, // أكثر من 30 دقيقة = متأخر
        isOverdue: true,
    },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN SEEDING FUNCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * يملأ النظام ببيانات تجريبية للعرض
 * @param tenantId معرف المستأجر (المدير)
 */
export async function seedDemoData(tenantId: string): Promise<DemoSeedResult> {
    if (!db) {
        return {
            success: false,
            roomsCreated: 0,
            employeesCreated: 0,
            requestsCreated: 0,
            error: 'Firebase not configured'
        };
    }

    const result: DemoSeedResult = {
        success: false,
        roomsCreated: 0,
        employeesCreated: 0,
        requestsCreated: 0
    };

    try {
        logger.info(`[DemoSeeder] Starting demo data seeding for tenant: ${tenantId}`, null, 'demoSeedingService');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 1️⃣ إنشاء الفرع التجريبي
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const branchRef = doc(collection(db, `tenants/${tenantId}/branches`));
        const branchId = branchRef.id;
        
        await setDoc(branchRef, {
            id: branchId,
            tenantId,
            ...DEMO_BRANCH,
            createdAt: serverTimestamp(),
            isDemo: true // علامة للتمييز
        });

        result.branchId = branchId;
        logger.info(`[DemoSeeder] Branch created: ${branchId}`, null, 'demoSeedingService');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2️⃣ إنشاء الغرف
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const roomsBatch = writeBatch(db);
        
        for (const room of DEMO_ROOMS) {
            const roomId = `${branchId}_${room.number}`;
            const roomRef = doc(db, `tenants/${tenantId}/rooms`, roomId);
            
            roomsBatch.set(roomRef, {
                id: roomId,
                number: room.number,
                floor: room.floor,
                type: room.type,
                status: room.status,
                currentGuestId: room.guestName ? `guest_${room.number}` : null,
                branchId,
                tenantId,
                isDemo: true
            });
            
            // إنشاء بطاقة غرفة للغرف المسكنة
            if (room.status === 'occupied' && room.guestName) {
                const cardRef = doc(collection(db, `tenants/${tenantId}/roomCards`));
                roomsBatch.set(cardRef, {
                    id: cardRef.id,
                    roomNumber: room.number,
                    branchId,
                    tenantId,
                    guestName: room.guestName,
                    guestPhone: `05${Math.floor(10000000 + Math.random() * 90000000)}`,
                    guestIdLast4: `${Math.floor(1000 + Math.random() * 9000)}`,
                    status: 'active',
                    qrActive: true,
                    checkInAt: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)), // أمس
                    expectedCheckOut: Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)), // بعد يومين
                    isDemo: true
                });
            }
            
            result.roomsCreated++;
        }
        
        await roomsBatch.commit();
        logger.info(`[DemoSeeder] ${result.roomsCreated} rooms created`, null, 'demoSeedingService');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 3️⃣ إنشاء الموظفين
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const employeesBatch = writeBatch(db);
        
        for (const emp of DEMO_EMPLOYEES) {
            const empRef = doc(collection(db, `tenants/${tenantId}/employees`));
            
            employeesBatch.set(empRef, {
                id: empRef.id,
                name: emp.name,
                code: emp.code,
                department: emp.department,
                role: emp.role,
                status: 'active',
                branches: [branchId],
                tenantId,
                points: Math.floor(Math.random() * 500) + 100,
                tasksCompleted: Math.floor(Math.random() * 50) + 10,
                averageRating: (Math.random() * 1 + 4).toFixed(1), // 4.0 - 5.0
                createdAt: serverTimestamp(),
                isDemo: true
            });
            
            // إنشاء Global Code
            const globalCodeRef = doc(db, 'globalCodes', `${DEMO_BRANCH.code}${emp.code}`);
            employeesBatch.set(globalCodeRef, {
                code: `${DEMO_BRANCH.code}${emp.code}`,
                tenantId,
                employeeId: empRef.id,
                role: emp.role,
                department: emp.department,
                createdAt: serverTimestamp(),
                isDemo: true
            });
            
            result.employeesCreated++;
        }
        
        await employeesBatch.commit();
        logger.info(`[DemoSeeder] ${result.employeesCreated} employees created`, null, 'demoSeedingService');

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 4️⃣ إنشاء الطلبات
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const requestsBatch = writeBatch(db);
        
        for (const req of DEMO_REQUESTS) {
            const reqRef = doc(collection(db, 'requests'));
            const createdAt = new Date(Date.now() - (req.createdMinutesAgo || 0) * 60 * 1000);
            
            const requestData: any = {
                id: reqRef.id,
                type: req.type,
                status: req.status,
                priority: req.priority,
                source: 'demo',
                roomNumber: req.roomNumber,
                guestName: req.guestName,
                branch: branchId,
                tenantId,
                createdBy: { id: 'demo', name: 'نظام الديمو', department: 'system' },
                createdAt: Timestamp.fromDate(createdAt),
                title: req.title,
                details: { description: req.description },
                currentDepartment: req.type === 'bellman' ? 'bellman' : 
                                   req.type === 'cleaning' ? 'housekeeping' :
                                   req.type === 'maintenance' ? 'maintenance' : 'reception',
                isDemo: true
            };
            
            // إضافة بيانات الإكمال للطلبات المكتملة
            if (req.status === 'COMPLETED' && req.completedMinutesAgo) {
                const completedAt = new Date(Date.now() - req.completedMinutesAgo * 60 * 1000);
                requestData.completedAt = Timestamp.fromDate(completedAt);
                requestData.completedBy = { id: 'demo', name: 'موظف تجريبي' };
                requestData.rating = req.rating;
                requestData.timeline = {
                    created: Timestamp.fromDate(createdAt),
                    completed: Timestamp.fromDate(completedAt)
                };
            }
            
            // علامة التأخير
            if (req.isOverdue) {
                requestData.isOverdue = true;
            }
            
            requestsBatch.set(reqRef, requestData);
            result.requestsCreated++;
        }
        
        await requestsBatch.commit();
        logger.info(`[DemoSeeder] ${result.requestsCreated} requests created`, null, 'demoSeedingService');

        result.success = true;
        logger.info(`[DemoSeeder] ✅ Demo data seeding completed successfully!`, null, 'demoSeedingService');

        return result;

    } catch (error: any) {
        logger.error('[DemoSeeder] Failed to seed demo data', error, 'demoSeedingService');
        return {
            ...result,
            success: false,
            error: error.message || 'Unknown error'
        };
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLEAR DEMO DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * يحذف جميع البيانات التجريبية
 * @param tenantId معرف المستأجر
 */
export async function clearDemoData(tenantId: string): Promise<{ success: boolean; error?: string }> {
    if (!db) {
        return { success: false, error: 'Firebase not configured' };
    }

    try {
        logger.info(`[DemoSeeder] Clearing demo data for tenant: ${tenantId}`, null, 'demoSeedingService');

        // حذف الفروع التجريبية
        const branchesQuery = query(
            collection(db, `tenants/${tenantId}/branches`),
            where('isDemo', '==', true)
        );
        const branchesSnap = await getDocs(branchesQuery);
        for (const branchDoc of branchesSnap.docs) {
            await deleteDoc(branchDoc.ref);
        }

        // حذف الغرف التجريبية
        const roomsQuery = query(
            collection(db, `tenants/${tenantId}/rooms`),
            where('isDemo', '==', true)
        );
        const roomsSnap = await getDocs(roomsQuery);
        for (const roomDoc of roomsSnap.docs) {
            await deleteDoc(roomDoc.ref);
        }

        // حذف الموظفين التجريبيين
        const employeesQuery = query(
            collection(db, `tenants/${tenantId}/employees`),
            where('isDemo', '==', true)
        );
        const employeesSnap = await getDocs(employeesQuery);
        for (const empDoc of employeesSnap.docs) {
            await deleteDoc(empDoc.ref);
        }

        // حذف بطاقات الغرف التجريبية
        const cardsQuery = query(
            collection(db, `tenants/${tenantId}/roomCards`),
            where('isDemo', '==', true)
        );
        const cardsSnap = await getDocs(cardsQuery);
        for (const cardDoc of cardsSnap.docs) {
            await deleteDoc(cardDoc.ref);
        }

        // حذف الطلبات التجريبية
        const requestsQuery = query(
            collection(db, 'requests'),
            where('tenantId', '==', tenantId),
            where('isDemo', '==', true)
        );
        const requestsSnap = await getDocs(requestsQuery);
        for (const reqDoc of requestsSnap.docs) {
            await deleteDoc(reqDoc.ref);
        }

        // حذف Global Codes التجريبية
        const codesQuery = query(
            collection(db, 'globalCodes'),
            where('tenantId', '==', tenantId),
            where('isDemo', '==', true)
        );
        const codesSnap = await getDocs(codesQuery);
        for (const codeDoc of codesSnap.docs) {
            await deleteDoc(codeDoc.ref);
        }

        logger.info(`[DemoSeeder] ✅ Demo data cleared successfully!`, null, 'demoSeedingService');
        return { success: true };

    } catch (error: any) {
        logger.error('[DemoSeeder] Failed to clear demo data', error, 'demoSeedingService');
        return { success: false, error: error.message };
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECK IF DEMO DATA EXISTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * يتحقق إذا كانت بيانات الديمو موجودة
 */
export async function hasDemoData(tenantId: string): Promise<boolean> {
    if (!db) return false;

    try {
        const branchesQuery = query(
            collection(db, `tenants/${tenantId}/branches`),
            where('isDemo', '==', true)
        );
        const snapshot = await getDocs(branchesQuery);
        return !snapshot.empty;
    } catch {
        return false;
    }
}
