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
    serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';

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
 */
const isCollectionEmpty = async (collectionName: string): Promise<boolean> => {
    if (!db) return true;

    try {
        const q = query(collection(db, collectionName), limit(1));
        const snapshot = await getDocs(q);
        return snapshot.empty;
    } catch (error: any) {
        // ✅ Graceful handling: If permission denied, assume collection needs seeding
        // This allows seeding to proceed even if read access is restricted
        const isPermissionError = error?.code === 'permission-denied' || 
                                  error?.message?.includes('permission') ||
                                  error?.message?.includes('Missing or insufficient');
        
        if (isPermissionError) {
            // If we can't read due to permissions, assume it needs seeding
            // The seeding write will either succeed (if we have write access) or fail gracefully
            return true;
        }
        
        // For other errors, also assume it needs seeding to attempt fixing
        return true;
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
 */
const seedRoomStatuses = async (): Promise<number> => {
    if (!db) return 0;
    let count = 0;

    for (const status of DEFAULT_ROOM_STATUSES) {
        await setDoc(doc(db, 'roomStatuses', status.id), {
            ...status,
            createdAt: serverTimestamp()
        }, { merge: true });
        count++;
    }

    return count;
};

/**
 * Seed departments collection
 */
const seedDepartments = async (): Promise<number> => {
    if (!db) return 0;
    let count = 0;

    for (const dept of DEFAULT_DEPARTMENTS) {
        await setDoc(doc(db, 'departments', dept.id), {
            ...dept,
            createdAt: serverTimestamp()
        }, { merge: true });
        count++;
    }

    return count;
};

/**
 * Seed roles collection
 */
const seedRoles = async (): Promise<number> => {
    if (!db) return 0;
    let count = 0;

    for (const role of DEFAULT_ROLES) {
        await setDoc(doc(db, 'roles', role.id), {
            ...role,
            createdAt: serverTimestamp()
        }, { merge: true });
        count++;
    }

    return count;
};

/**
 * Seed maintenance templates collection
 */
const seedMaintenanceTemplates = async (): Promise<number> => {
    if (!db) return 0;
    let count = 0;

    for (const template of DEFAULT_MAINTENANCE_TEMPLATES) {
        await setDoc(doc(db, 'maintenanceTemplates', template.id), {
            ...template,
            createdAt: serverTimestamp()
        }, { merge: true });
        count++;
    }

    return count;
};

/**
 * Seed ranks collection (for gamification)
 */
const seedRanks = async (): Promise<number> => {
    if (!db) return 0;
    let count = 0;

    for (const rank of DEFAULT_RANKS) {
        await setDoc(doc(db, 'ranks', rank.id), {
            ...rank,
            createdAt: serverTimestamp()
        }, { merge: true });
        count++;
    }

    return count;
};

/**
 * Seed achievements collection for a specific tenant (for gamification ranks)
 * This creates the default rank progression system
 */
export const seedTenantAchievements = async (tenantId: string): Promise<number> => {
    if (!db || !tenantId) return 0;
    let count = 0;

    for (const achievement of DEFAULT_ACHIEVEMENTS) {
        await setDoc(doc(db, `tenants/${tenantId}/achievements`, achievement.id), {
            ...achievement,
            createdAt: serverTimestamp()
        }, { merge: true });
        count++;
    }

    console.log(`  ✅ ${count} achievements seeded for tenant ${tenantId}`);
    return count;
};

/**
 * Create demo room
 */
const seedDemoRoom = async (): Promise<number> => {
    if (!db) return 0;

    // Check if any rooms exist
    const roomsEmpty = await isCollectionEmpty('rooms');
    if (!roomsEmpty) return 0;

    await setDoc(doc(db, 'rooms', DEFAULT_DEMO_ROOM.id), {
        ...DEFAULT_DEMO_ROOM,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return 1;
};

/**
 * Create health check document
 */
const seedHealthCheck = async (): Promise<number> => {
    if (!db) return 0;

    await setDoc(doc(db, 'health_check', 'status'), {
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
 * Uses merge: true to avoid overwriting existing data
 */
export const seedTenantDatabase = async (options?: {
    forceReseed?: boolean;
    includeDemoRoom?: boolean;
}): Promise<SeedingResult> => {
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

    const { forceReseed = false, includeDemoRoom = true } = options || {};

    console.log('🌱 Starting database seeding...');

    try {
        // Settings
        try {
            if (forceReseed || await isCollectionEmpty('settings')) {
                const count = await seedSettings();
                result.totalDocuments += count;
                result.collectionsCreated.push('settings');
                console.log('  ✅ settings seeded');
            }
        } catch (e: any) {
            result.errors.push(`settings: ${e.message}`);
        }

        // Room Statuses
        try {
            if (forceReseed || await isCollectionEmpty('roomStatuses')) {
                const count = await seedRoomStatuses();
                result.totalDocuments += count;
                result.collectionsCreated.push('roomStatuses');
                console.log('  ✅ roomStatuses seeded');
            }
        } catch (e: any) {
            result.errors.push(`roomStatuses: ${e.message}`);
        }

        // Departments
        try {
            if (forceReseed || await isCollectionEmpty('departments')) {
                const count = await seedDepartments();
                result.totalDocuments += count;
                result.collectionsCreated.push('departments');
                console.log('  ✅ departments seeded');
            }
        } catch (e: any) {
            result.errors.push(`departments: ${e.message}`);
        }

        // Roles
        try {
            if (forceReseed || await isCollectionEmpty('roles')) {
                const count = await seedRoles();
                result.totalDocuments += count;
                result.collectionsCreated.push('roles');
                console.log('  ✅ roles seeded');
            }
        } catch (e: any) {
            result.errors.push(`roles: ${e.message}`);
        }

        // Maintenance Templates
        try {
            if (forceReseed || await isCollectionEmpty('maintenanceTemplates')) {
                const count = await seedMaintenanceTemplates();
                result.totalDocuments += count;
                result.collectionsCreated.push('maintenanceTemplates');
                console.log('  ✅ maintenanceTemplates seeded');
            }
        } catch (e: any) {
            result.errors.push(`maintenanceTemplates: ${e.message}`);
        }

        // Ranks
        try {
            if (forceReseed || await isCollectionEmpty('ranks')) {
                const count = await seedRanks();
                result.totalDocuments += count;
                result.collectionsCreated.push('ranks');
                console.log('  ✅ ranks seeded');
            }
        } catch (e: any) {
            result.errors.push(`ranks: ${e.message}`);
        }

        // Health Check
        try {
            const count = await seedHealthCheck();
            result.totalDocuments += count;
            result.collectionsCreated.push('health_check');
            console.log('  ✅ health_check seeded');
        } catch (e: any) {
            result.errors.push(`health_check: ${e.message}`);
        }

        // Demo Room (optional)
        if (includeDemoRoom) {
            try {
                const count = await seedDemoRoom();
                if (count > 0) {
                    result.totalDocuments += count;
                    result.collectionsCreated.push('rooms (demo)');
                    console.log('  ✅ demo room created');
                }
            } catch (e: any) {
                result.errors.push(`demo room: ${e.message}`);
            }
        }

        result.success = result.errors.length === 0;

        if (result.success) {
            console.log(`✅ Seeding complete! ${result.totalDocuments} documents created.`);
        } else {
            console.warn(`⚠️ Seeding completed with ${result.errors.length} errors.`);
        }

        return result;

    } catch (error: any) {
        console.error('❌ Seeding failed:', error);
        result.errors.push(error.message);
        return result;
    }
};

/**
 * Check which collections are missing
 */
export const checkMissingCollections = async (): Promise<string[]> => {
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
        const isEmpty = await isCollectionEmpty(collectionName);
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
