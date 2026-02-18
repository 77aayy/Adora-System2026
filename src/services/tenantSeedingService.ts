/**
 * Tenant Database Seeding Service 🌱
 * Automatically populates default data for new tenant databases
 * 
 * When a new manager creates their Firebase project, this service:
 * 1. Creates all required collections
 * 2. Populates default settings, statuses, departments, etc.
 * 3. Creates a demo room (101) so the dashboard isn't empty
 * 
 * Adora Hotel Management System V3
 */

import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    limit,
    Timestamp,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface SeedingResult {
    success: boolean;
    collectionsCreated: string[];
    errors: string[];
    totalDocuments: number;
}

export interface DefaultSettings {
    language: string;
    currency: string;
    currencySymbol: string;
    taxRate: number;
    hotelName: string;
    timezone: string;
    branding: {
        primaryColor: string;
        secondaryColor: string;
        logo: string | null;
    };
    features: {
        gamificationEnabled: boolean;
        pointsEnabled: boolean;
        whatsappEnabled: boolean;
        coffeeShopEnabled: boolean;
        maintenanceEnabled: boolean;
    };
}

// ============================================================
// DEFAULT DATA
// ============================================================

export const DEFAULT_SETTINGS: DefaultSettings = {
    language: 'ar',
    currency: 'EGP',
    currencySymbol: 'ج.م',
    taxRate: 14, // Egyptian VAT
    hotelName: 'فندقي',
    timezone: 'Africa/Cairo',
    branding: {
        primaryColor: '#f59e0b', // Amber
        secondaryColor: '#14b8a6', // Teal
        logo: null
    },
    features: {
        gamificationEnabled: true,
        pointsEnabled: true,
        whatsappEnabled: false,
        coffeeShopEnabled: true,
        maintenanceEnabled: true
    }
};

export const DEFAULT_ROOM_STATUSES = [
    {
        id: 'clean',
        name: 'نظيفة',
        nameEn: 'Clean',
        color: '#22c55e', // Green
        icon: '✅',
        order: 1,
        isDefault: true
    },
    {
        id: 'dirty',
        name: 'غير نظيفة',
        nameEn: 'Dirty',
        color: '#ef4444', // Red
        icon: '🧹',
        order: 2,
        isDefault: false
    },
    {
        id: 'maintenance',
        name: 'صيانة',
        nameEn: 'Maintenance',
        color: '#f59e0b', // Amber
        icon: '🛠️',
        order: 3,
        isDefault: false
    },
    {
        id: 'inspecting',
        name: 'تفتيش',
        nameEn: 'Inspecting',
        color: '#3b82f6', // Blue
        icon: '🔍',
        order: 4,
        isDefault: false
    },
    {
        id: 'checkout',
        name: 'إخلاء',
        nameEn: 'Checkout',
        color: '#8b5cf6', // Purple
        icon: '🚪',
        order: 5,
        isDefault: false
    }
];

export const DEFAULT_DEPARTMENTS = [
    {
        id: 'reception',
        name: 'الاستقبال',
        nameEn: 'Reception',
        icon: '🛎️',
        color: '#3b82f6',
        isActive: true,
        order: 1
    },
    {
        id: 'housekeeping',
        name: 'النظافة',
        nameEn: 'Housekeeping',
        icon: '🧹',
        color: '#22c55e',
        isActive: true,
        order: 2
    },
    {
        id: 'maintenance',
        name: 'الصيانة',
        nameEn: 'Maintenance',
        icon: '🛠️',
        color: '#f59e0b',
        isActive: true,
        order: 3
    },
    {
        id: 'coffeeshop',
        name: 'الكافي شوب',
        nameEn: 'Coffee Shop',
        icon: '☕',
        color: '#78350f',
        isActive: true,
        order: 4
    },
    {
        id: 'bellman',
        name: 'البيلمان',
        nameEn: 'Bellman',
        icon: '🧳',
        color: '#8b5cf6',
        isActive: true,
        order: 5
    }
];

export const DEFAULT_ROLES = [
    {
        id: 'admin',
        name: 'مدير',
        nameEn: 'Admin',
        permissions: ['all'],
        level: 100,
        color: '#ef4444'
    },
    {
        id: 'supervisor',
        name: 'مشرف',
        nameEn: 'Supervisor',
        permissions: ['view', 'edit', 'assign', 'reports'],
        level: 50,
        color: '#f59e0b'
    },
    {
        id: 'staff',
        name: 'موظف',
        nameEn: 'Staff',
        permissions: ['view', 'execute'],
        level: 10,
        color: '#3b82f6'
    }
];

export const DEFAULT_MAINTENANCE_TEMPLATES = [
    {
        id: 'plumbing',
        name: 'أعطال السباكة',
        nameEn: 'Plumbing Issues',
        icon: '🚿',
        category: 'plumbing',
        priority: 'high',
        commonIssues: [
            'تسريب مياه',
            'انسداد الحوض',
            'مشكلة في السيفون',
            'سخان المياه لا يعمل'
        ]
    },
    {
        id: 'electrical',
        name: 'أعطال الكهرباء',
        nameEn: 'Electrical Issues',
        icon: '💡',
        category: 'electrical',
        priority: 'high',
        commonIssues: [
            'عدم وجود كهرباء',
            'ماس كهربائي',
            'مفتاح لا يعمل',
            'إضاءة معطلة'
        ]
    },
    {
        id: 'ac',
        name: 'أعطال التكييف',
        nameEn: 'AC Issues',
        icon: '❄️',
        category: 'hvac',
        priority: 'medium',
        commonIssues: [
            'التكييف لا يبرد',
            'تسريب مياه من التكييف',
            'صوت مزعج',
            'ريموت لا يعمل'
        ]
    },
    {
        id: 'furniture',
        name: 'أعطال الأثاث',
        nameEn: 'Furniture Issues',
        icon: '🛋️',
        category: 'furniture',
        priority: 'low',
        commonIssues: [
            'باب معطل',
            'مفصلة مكسورة',
            'كرسي متهالك',
            'زجاج مكسور'
        ]
    },
    {
        id: 'tv',
        name: 'أعطال التلفزيون',
        nameEn: 'TV Issues',
        icon: '📺',
        category: 'electronics',
        priority: 'low',
        commonIssues: [
            'لا يعمل',
            'لا يوجد صوت',
            'ريموت معطل',
            'قنوات غير متاحة'
        ]
    }
];

export const DEFAULT_RANKS = [
    {
        id: 'bronze',
        name: 'البرونزي',
        nameEn: 'Bronze',
        minPoints: 0,
        icon: '🥉',
        color: '#cd7f32',
        benefits: ['شارة برونزية']
    },
    {
        id: 'silver',
        name: 'الفضي',
        nameEn: 'Silver',
        minPoints: 100,
        icon: '🥈',
        color: '#c0c0c0',
        benefits: ['شارة فضية', 'أولوية في المهام']
    },
    {
        id: 'gold',
        name: 'الذهبي',
        nameEn: 'Gold',
        minPoints: 500,
        icon: '🥇',
        color: '#ffd700',
        benefits: ['شارة ذهبية', 'مكافأة شهرية', 'إجازة إضافية']
    },
    {
        id: 'platinum',
        name: 'البلاتيني',
        nameEn: 'Platinum',
        minPoints: 1000,
        icon: '💎',
        color: '#e5e4e2',
        benefits: ['شارة بلاتينية', 'مكافأة مضاعفة', 'امتيازات VIP']
    }
];

// Default Achievements/Ranks for Gamification System (stored per tenant)
export const DEFAULT_ACHIEVEMENTS = Array.from({ length: 20 }, (_, i) => {
    const points = (i + 1) * 100;
    let name = `المستوى ${i + 1}`;
    if (points === 500) name = 'مشرف برونزي';
    if (points === 1000) name = 'مشرف فضي';
    if (points === 1500) name = 'مشرف ذهبي';
    if (points === 2000) name = 'موظف ماسي';

    return {
        id: `level-${i + 1}`,
        name,
        description: `الوصول إلى ${points} نقطة تراكمية`,
        pointsReward: 0, // Ranks don't give points, they're status
        icon: points >= 1500 ? 'Crown' : (points >= 1000 ? 'Medal' : 'Star'),
        color: points >= 2000 ? 'text-cyan-400' : (points >= 1500 ? 'text-yellow-400' : 'text-blue-400'),
        bgColor: points >= 2000 ? 'bg-cyan-500/20' : (points >= 1500 ? 'bg-yellow-500/20' : 'bg-blue-500/20'),
        isRepeatable: false,
        category: 'rank' as const,
        requirement: { type: 'points' as const, value: points },
        active: true
    };
});

// Demo room for initial setup
export const DEFAULT_DEMO_ROOM = {
    id: 'room-101',
    roomNumber: '101',
    floor: '1',
    type: 'standard',
    status: 'clean',
    isActive: true,
    isOccupied: false,
    lastCleaned: null,
    assignedTo: null,
    guestName: null,
    checkInDate: null,
    checkOutDate: null,
    notes: 'غرفة تجريبية - يمكنك حذفها أو تعديلها'
};

// Health check document for connection testing
export const HEALTH_CHECK_DOC = {
    status: 'healthy',
    initialized: true,
    version: '3.0.0',
    lastCheck: null // Will be set to serverTimestamp
};

// ============================================================
// SEEDING FUNCTIONS
// ============================================================

/**
 * Check if a collection has any documents
 * ✅ SaaS: Uses tenantId for data isolation
 */
const isCollectionEmpty = async (collectionName: string, tenantId?: string): Promise<boolean> => {
    if (!db) return true;

    try {
        // ✅ SaaS: Use tenant path if tenantId provided
        const collectionPath = tenantId 
            ? `tenants/${tenantId}/${collectionName}`
            : collectionName;
        const q = query(collection(db, collectionPath), limit(1));
        const snapshot = await getDocs(q);
        return snapshot.empty;
    } catch (error: any) {
        // ✅ Graceful handling: If permission denied, assume collection needs seeding
        const isPermissionError = error?.code === 'permission-denied' || 
                                  error?.message?.includes('permission') ||
                                  error?.message?.includes('Missing or insufficient');
        
        if (isPermissionError) {
            return true; // Assume needs seeding
        }
        
        return true; // For other errors, assume needs seeding
    }
};

/**
 * Seed settings collection
 */
const seedSettings = async (): Promise<number> => {
    if (!db) return 0;

    await setDoc(doc(db, 'settings', 'general'), {
        ...DEFAULT_SETTINGS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });

    return 1;
};

/**
 * Seed room statuses collection
 * ✅ SaaS: Uses tenantId for data isolation
 * ✅ FIX: Uses batch writes to prevent "INTERNAL ASSERTION FAILED" errors
 */
const seedRoomStatuses = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;
    let count = 0;
    const BATCH_SIZE = 50;
    const statuses = [...DEFAULT_ROOM_STATUSES];

    for (let i = 0; i < statuses.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = statuses.slice(i, i + BATCH_SIZE);

        for (const status of chunk) {
            batch.set(doc(db, `tenants/${tenantId}/roomStatuses`, status.id), {
                ...status,
                createdAt: serverTimestamp()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        
        if (i + BATCH_SIZE < statuses.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return count;
};

/**
 * Seed departments collection
 * ✅ SaaS: Uses tenantId for data isolation
 * ✅ FIX: Uses batch writes to prevent "INTERNAL ASSERTION FAILED" errors
 */
const seedDepartments = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;
    let count = 0;
    const BATCH_SIZE = 50;
    const departments = [...DEFAULT_DEPARTMENTS];

    for (let i = 0; i < departments.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = departments.slice(i, i + BATCH_SIZE);

        for (const dept of chunk) {
            batch.set(doc(db, `tenants/${tenantId}/departments`, dept.id), {
                ...dept,
                createdAt: serverTimestamp()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        
        if (i + BATCH_SIZE < departments.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return count;
};

/**
 * Seed roles collection
 * ✅ SaaS: Uses tenantId for data isolation
 * ✅ FIX: Uses batch writes to prevent "INTERNAL ASSERTION FAILED" errors
 */
const seedRoles = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;
    let count = 0;
    const BATCH_SIZE = 50;
    const roles = [...DEFAULT_ROLES];

    for (let i = 0; i < roles.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = roles.slice(i, i + BATCH_SIZE);

        for (const role of chunk) {
            batch.set(doc(db, `tenants/${tenantId}/roles`, role.id), {
                ...role,
                createdAt: serverTimestamp()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        
        if (i + BATCH_SIZE < roles.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return count;
};

/**
 * Seed maintenance templates collection
 * ✅ SaaS: Uses tenantId for data isolation
 * ✅ FIX: Uses batch writes to prevent "INTERNAL ASSERTION FAILED" errors
 */
const seedMaintenanceTemplates = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;
    let count = 0;
    const BATCH_SIZE = 50;
    const templates = [...DEFAULT_MAINTENANCE_TEMPLATES];

    for (let i = 0; i < templates.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = templates.slice(i, i + BATCH_SIZE);

        for (const template of chunk) {
            batch.set(doc(db, `tenants/${tenantId}/maintenanceTemplates`, template.id), {
                ...template,
                createdAt: serverTimestamp()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        
        if (i + BATCH_SIZE < templates.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return count;
};

/**
 * Seed ranks collection (for gamification)
 * ✅ SaaS: Uses tenantId for data isolation
 * ✅ FIX: Uses batch writes to prevent "INTERNAL ASSERTION FAILED" errors
 */
const seedRanks = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;
    let count = 0;
    const BATCH_SIZE = 50;
    const ranks = [...DEFAULT_RANKS];

    for (let i = 0; i < ranks.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = ranks.slice(i, i + BATCH_SIZE);

        for (const rank of chunk) {
            batch.set(doc(db, `tenants/${tenantId}/ranks`, rank.id), {
                ...rank,
                createdAt: serverTimestamp()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        
        if (i + BATCH_SIZE < ranks.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return count;
};

/**
 * Seed achievements collection for a specific tenant (for gamification ranks)
 * This creates the default rank progression system
 * ✅ FIX: Uses batch writes to prevent "INTERNAL ASSERTION FAILED" errors
 */
export const seedTenantAchievements = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;
    let count = 0;
    const BATCH_SIZE = 50;
    const achievements = [...DEFAULT_ACHIEVEMENTS];

    for (let i = 0; i < achievements.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = achievements.slice(i, i + BATCH_SIZE);

        for (const achievement of chunk) {
            batch.set(doc(db, `tenants/${tenantId}/achievements`, achievement.id), {
                ...achievement,
                createdAt: serverTimestamp()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        
        if (i + BATCH_SIZE < achievements.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    logger.info(`  ✅ ${count} achievements seeded for tenant ${tenantId}`, undefined, 'tenantSeedingService');
    return count;
};

/**
 * Create demo room
 * ✅ SaaS: Uses tenantId for data isolation
 */
const seedDemoRoom = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;

    // Check if any rooms exist
    const roomsEmpty = await isCollectionEmpty('rooms', tenantId);
    if (!roomsEmpty) return 0;

    await setDoc(doc(db, `tenants/${tenantId}/rooms`, DEFAULT_DEMO_ROOM.id), {
        ...DEFAULT_DEMO_ROOM,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return 1;
};

/**
 * Create health check document
 * ✅ SaaS: Uses tenantId for data isolation
 */
const seedHealthCheck = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;

    await setDoc(doc(db, `tenants/${tenantId}/health_check`, 'status'), {
        ...HEALTH_CHECK_DOC,
        lastCheck: serverTimestamp()
    });

    return 1;
};

// ============================================================
// MAIN SEEDING FUNCTION
// ============================================================

/**
 * Seeds all required collections for a new tenant database
 * ✅ SaaS: Uses tenantId for data isolation
 * Uses merge: true to avoid overwriting existing data
 */
export const seedTenantDatabase = async (
    tenantId: string,
    options?: {
        forceReseed?: boolean;
        includeDemoRoom?: boolean;
    }
): Promise<SeedingResult> => {
    const result: SeedingResult = {
        success: false,
        collectionsCreated: [],
        errors: [],
        totalDocuments: 0
    };

    if (!db) {
        result.errors.push('Firebase not initialized');
        return result;
    }

    if (!tenantId) {
        result.errors.push('tenantId is required for SaaS isolation');
        return result;
    }

    const { forceReseed = false, includeDemoRoom = true } = options || {};

    logger.info(`🌱 Starting database seeding for tenant: ${tenantId}...`, undefined, 'tenantSeedingService');

    try {
        // ✅ FIX: Add delay between collections to prevent overwhelming Firestore
        // Settings
        try {
            if (forceReseed || await isCollectionEmpty('settings', tenantId)) {
                const count = await seedSettings(tenantId);
                result.totalDocuments += count;
                result.collectionsCreated.push('settings');
                logger.info('  ✅ settings seeded', undefined, 'tenantSeedingService');
                await new Promise(resolve => setTimeout(resolve, 200)); // Delay between collections
            }
        } catch (e: any) {
            // ✅ Handle permission errors gracefully
            const isPermissionError = e?.code === 'permission-denied' || 
                                      e?.message?.includes('permission') ||
                                      e?.message?.includes('Missing or insufficient');
            
            if (isPermissionError) {
                result.errors.push(`settings: Permission denied (expected)`);
                logger.debug('Permission denied for seeding settings (expected)', e, 'tenantSeedingService');
            } else {
                result.errors.push(`settings: ${e.message}`);
                logger.error('❌ Error seeding settings:', e, 'tenantSeedingService');
            }
        }

        // Room Statuses
        try {
            const isEmpty = await isCollectionEmpty('roomStatuses', tenantId);
            logger.debug(`  🔍 roomStatuses empty check: ${isEmpty} (forceReseed: ${forceReseed})`, undefined, 'tenantSeedingService');
            if (forceReseed || isEmpty) {
                const count = await seedRoomStatuses(tenantId);
                result.totalDocuments += count;
                result.collectionsCreated.push('roomStatuses');
                logger.debug(`  ✅ roomStatuses seeded (${count} documents)`, undefined, 'tenantSeedingService');
                await new Promise(resolve => setTimeout(resolve, 200));
            } else {
                logger.debug('  ⏭️ roomStatuses skipped (not empty)', undefined, 'tenantSeedingService');
            }
        } catch (e: any) {
            const isPermissionError = e?.code === 'permission-denied' || e?.message?.includes('permission') || e?.message?.includes('Missing or insufficient');
            result.errors.push(isPermissionError ? 'roomStatuses: Permission denied (expected)' : `roomStatuses: ${e.message}`);
            if (isPermissionError) logger.debug('Permission denied for seeding roomStatuses (expected)', undefined, 'tenantSeedingService');
            else logger.error('❌ Error seeding roomStatuses:', e, 'tenantSeedingService');
        }

        // Departments
        try {
            if (forceReseed || await isCollectionEmpty('departments', tenantId)) {
                const count = await seedDepartments(tenantId);
                result.totalDocuments += count;
                result.collectionsCreated.push('departments');
                logger.info('  ✅ departments seeded', undefined, 'tenantSeedingService');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (e: any) {
            const isPermissionError = e?.code === 'permission-denied' || e?.message?.includes('permission') || e?.message?.includes('Missing or insufficient');
            result.errors.push(isPermissionError ? 'departments: Permission denied (expected)' : `departments: ${e.message}`);
            if (isPermissionError) logger.debug('Permission denied for seeding departments (expected)', undefined, 'tenantSeedingService');
            else logger.error('❌ Error seeding departments:', e, 'tenantSeedingService');
        }

        // Roles
        try {
            if (forceReseed || await isCollectionEmpty('roles', tenantId)) {
                const count = await seedRoles(tenantId);
                result.totalDocuments += count;
                result.collectionsCreated.push('roles');
                logger.info('  ✅ roles seeded', undefined, 'tenantSeedingService');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (e: any) {
            const isPermissionError = e?.code === 'permission-denied' || e?.message?.includes('permission') || e?.message?.includes('Missing or insufficient');
            result.errors.push(isPermissionError ? 'roles: Permission denied (expected)' : `roles: ${e.message}`);
            if (isPermissionError) logger.debug('Permission denied for seeding roles (expected)', undefined, 'tenantSeedingService');
            else logger.error('❌ Error seeding roles:', e, 'tenantSeedingService');
        }

        // Maintenance Templates
        try {
            if (forceReseed || await isCollectionEmpty('maintenanceTemplates', tenantId)) {
                const count = await seedMaintenanceTemplates(tenantId);
                result.totalDocuments += count;
                result.collectionsCreated.push('maintenanceTemplates');
                logger.info('  ✅ maintenanceTemplates seeded', undefined, 'tenantSeedingService');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (e: any) {
            const isPermissionError = e?.code === 'permission-denied' || e?.message?.includes('permission') || e?.message?.includes('Missing or insufficient');
            result.errors.push(isPermissionError ? 'maintenanceTemplates: Permission denied (expected)' : `maintenanceTemplates: ${e.message}`);
            if (isPermissionError) logger.debug('Permission denied for seeding maintenanceTemplates (expected)', undefined, 'tenantSeedingService');
            else logger.error('❌ Error seeding maintenanceTemplates:', e, 'tenantSeedingService');
        }

        // Ranks
        try {
            if (forceReseed || await isCollectionEmpty('ranks', tenantId)) {
                const count = await seedRanks(tenantId);
                result.totalDocuments += count;
                result.collectionsCreated.push('ranks');
                logger.info('  ✅ ranks seeded', undefined, 'tenantSeedingService');
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (e: any) {
            const isPermissionError = e?.code === 'permission-denied' || e?.message?.includes('permission') || e?.message?.includes('Missing or insufficient');
            result.errors.push(isPermissionError ? 'ranks: Permission denied (expected)' : `ranks: ${e.message}`);
            if (isPermissionError) logger.debug('Permission denied for seeding ranks (expected)', undefined, 'tenantSeedingService');
            else logger.error('❌ Error seeding ranks:', e, 'tenantSeedingService');
        }

        // Health Check
        try {
            const count = await seedHealthCheck(tenantId);
            result.totalDocuments += count;
            result.collectionsCreated.push('health_check');
            logger.info('  ✅ health_check seeded', undefined, 'tenantSeedingService');
        } catch (e: any) {
            result.errors.push(`health_check: ${e.message}`);
        }

        // Demo Room (optional)
        if (includeDemoRoom) {
            try {
                const count = await seedDemoRoom(tenantId);
                if (count > 0) {
                    result.totalDocuments += count;
                    result.collectionsCreated.push('rooms (demo)');
                    logger.info('  ✅ demo room created', undefined, 'tenantSeedingService');
                }
            } catch (e: any) {
                result.errors.push(`demo room: ${e.message}`);
            }
        }

        result.success = result.errors.length === 0;

        if (result.success) {
            logger.info(`✅ Seeding complete! ${result.totalDocuments} documents created.`, undefined, 'tenantSeedingService');
        } else {
            logger.debug(`Seeding completed with ${result.errors.length} errors (may include expected permission denials).`, undefined, 'tenantSeedingService');
        }

        return result;

    } catch (error: any) {
        logger.error('❌ Seeding failed:', error, 'tenantSeedingService');
        result.errors.push(error.message);
        return result;
    }
};

/**
 * Check which collections are missing
 */
/**
 * Check for missing collections
 * ✅ SaaS: Uses tenantId for data isolation
 */
export const checkMissingCollections = async (tenantId?: string): Promise<string[]> => {
    const requiredCollections = [
        'settings',
        'roomStatuses',
        'departments',
        'roles',
        'maintenanceTemplates',
        'ranks',
        'health_check'
    ];

    const missing: string[] = [];

    for (const collectionName of requiredCollections) {
        const isEmpty = await isCollectionEmpty(collectionName, tenantId);
        if (isEmpty) {
            missing.push(collectionName);
        }
    }

    return missing;
};

export default {
    seedTenantDatabase,
    checkMissingCollections,
    DEFAULT_SETTINGS,
    DEFAULT_ROOM_STATUSES,
    DEFAULT_DEPARTMENTS,
    DEFAULT_ROLES,
    DEFAULT_MAINTENANCE_TEMPLATES,
    DEFAULT_RANKS
};
