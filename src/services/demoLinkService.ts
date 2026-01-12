/**
 * Demo Link Service
 * Comprehensive demo system for potential buyers
 * Features: Shareable links, permissions, tour guides, time limits
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import {
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
    query, where, getDocs, Timestamp, serverTimestamp, increment
} from 'firebase/firestore';
import { logger } from './loggerService';
import { seedDemoData, clearDemoData } from './demoSeedingService';

// ============================================================
// TYPES
// ============================================================

export type DemoPermissionLevel = 'viewer' | 'tester' | 'full_access';
export type DemoScope = 'all' | 'reception' | 'housekeeping' | 'bellman' | 'maintenance' | 'admin' | 'owner';

export interface DemoLinkConfig {
    id: string;
    createdBy: { id: string; name: string };
    tenantId: string;
    
    // Link Details
    linkCode: string; // Unique shareable code
    linkUrl: string;
    
    // Permissions
    permissionLevel: DemoPermissionLevel;
    allowedScopes: DemoScope[];
    canCreateRequests: boolean;
    canManageEmployees: boolean;
    canViewReports: boolean;
    canAccessSettings: boolean;
    
    // Demo Content
    includeTour: boolean;
    tourLanguage: 'ar' | 'en';
    showWatermark: boolean;
    
    // Limits
    maxUses: number; // 0 = unlimited
    currentUses: number;
    expiresAt: Timestamp | null;
    validForHours: number; // 0 = no expiry
    
    // Multi-License Demo
    multiLicense: boolean;
    licensesCount: number;
    branchesPerLicense: number;
    
    // Tracking
    createdAt: Timestamp;
    lastUsedAt?: Timestamp;
    usageHistory: DemoUsage[];
    
    // Status
    isActive: boolean;
    isPaused: boolean;
}

export interface DemoUsage {
    usedAt: Timestamp;
    userAgent: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    completedSteps: string[];
    feedbackGiven?: string;
}

export interface DemoSession {
    id: string;
    linkId: string;
    linkCode: string;
    tenantId: string;
    
    // Session Info
    startedAt: Timestamp;
    lastActivityAt: Timestamp;
    expiresAt: Timestamp;
    
    // Progress
    tourCompleted: boolean;
    visitedSections: string[];
    actionsPerformed: string[];
    currentStep: number;
    totalSteps: number;
    
    // User Info
    userName?: string;
    userEmail?: string;
    userPhone?: string;
    
    // Permissions (copied from link)
    permissions: {
        level: DemoPermissionLevel;
        scopes: DemoScope[];
        canCreateRequests: boolean;
        canManageEmployees: boolean;
        canViewReports: boolean;
        canAccessSettings: boolean;
    };
    
    // Status
    isActive: boolean;
}

export interface TourStep {
    id: string;
    order: number;
    targetSelector: string;
    title: string;
    titleEn: string;
    description: string;
    descriptionEn: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    highlight: boolean;
    allowInteraction: boolean;
    waitForAction?: string; // CSS selector or action name
    section: DemoScope;
    icon?: string;
    videoUrl?: string; // Optional video explanation
}

// ============================================================
// CONSTANTS
// ============================================================

const DEMO_LINKS_COLLECTION = 'demoLinks';
const DEMO_SESSIONS_COLLECTION = 'demoSessions';
const DEFAULT_EXPIRY_HOURS = 72; // 3 days
const DEFAULT_MAX_USES = 10;

// ============================================================
// LINK GENERATION
// ============================================================

/**
 * Generate a unique demo link code
 */
function generateLinkCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = 'DEMO-';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Create a new demo link
 */
export async function createDemoLink(
    createdBy: { id: string; name: string },
    tenantId: string,
    config: Partial<Omit<DemoLinkConfig, 'id' | 'linkCode' | 'linkUrl' | 'createdBy' | 'tenantId' | 'createdAt' | 'currentUses' | 'usageHistory'>>
): Promise<DemoLinkConfig> {
    try {
        const linkCode = generateLinkCode();
        const linkId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Build full URL
        const baseUrl = window.location.origin;
        const linkUrl = `${baseUrl}/demo/${linkCode}`;
        
        // Calculate expiry
        const validForHours = config.validForHours ?? DEFAULT_EXPIRY_HOURS;
        const expiresAt = validForHours > 0 
            ? Timestamp.fromDate(new Date(Date.now() + validForHours * 60 * 60 * 1000))
            : null;
        
        const demoLink: DemoLinkConfig = {
            id: linkId,
            createdBy,
            tenantId,
            linkCode,
            linkUrl,
            
            // Permissions
            permissionLevel: config.permissionLevel || 'tester',
            allowedScopes: config.allowedScopes || ['all'],
            canCreateRequests: config.canCreateRequests ?? true,
            canManageEmployees: config.canManageEmployees ?? false,
            canViewReports: config.canViewReports ?? true,
            canAccessSettings: config.canAccessSettings ?? false,
            
            // Demo Content
            includeTour: config.includeTour ?? true,
            tourLanguage: config.tourLanguage || 'ar',
            showWatermark: config.showWatermark ?? true,
            
            // Limits
            maxUses: config.maxUses ?? DEFAULT_MAX_USES,
            currentUses: 0,
            expiresAt,
            validForHours,
            
            // Multi-License
            multiLicense: config.multiLicense ?? false,
            licensesCount: config.licensesCount || 1,
            branchesPerLicense: config.branchesPerLicense || 1,
            
            // Tracking
            createdAt: Timestamp.now(),
            usageHistory: [],
            
            // Status
            isActive: true,
            isPaused: false,
        };
        
        await setDoc(doc(db, DEMO_LINKS_COLLECTION, linkId), demoLink);
        
        logger.info(`Demo link created: ${linkCode}`, { linkId, createdBy: createdBy.name }, 'demoLinkService');
        
        return demoLink;
    } catch (error) {
        logger.error('Error creating demo link:', error, 'demoLinkService');
        throw error;
    }
}

/**
 * Get demo link by code
 */
export async function getDemoLinkByCode(code: string): Promise<DemoLinkConfig | null> {
    try {
        const linksRef = collection(db, DEMO_LINKS_COLLECTION);
        const q = query(linksRef, where('linkCode', '==', code.toUpperCase()));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) return null;
        
        return snapshot.docs[0].data() as DemoLinkConfig;
    } catch (error) {
        logger.error('Error getting demo link:', error, 'demoLinkService');
        return null;
    }
}

/**
 * Validate demo link
 */
export async function validateDemoLink(code: string): Promise<{
    valid: boolean;
    link?: DemoLinkConfig;
    error?: string;
}> {
    const link = await getDemoLinkByCode(code);
    
    if (!link) {
        return { valid: false, error: 'رابط الديمو غير موجود' };
    }
    
    if (!link.isActive) {
        return { valid: false, error: 'رابط الديمو غير نشط' };
    }
    
    if (link.isPaused) {
        return { valid: false, error: 'رابط الديمو متوقف مؤقتاً' };
    }
    
    if (link.expiresAt && link.expiresAt.toDate() < new Date()) {
        return { valid: false, error: 'انتهت صلاحية رابط الديمو' };
    }
    
    if (link.maxUses > 0 && link.currentUses >= link.maxUses) {
        return { valid: false, error: 'تم استنفاد عدد مرات استخدام الرابط' };
    }
    
    return { valid: true, link };
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

/**
 * Start a demo session
 */
export async function startDemoSession(
    linkCode: string,
    userInfo?: { name?: string; email?: string; phone?: string }
): Promise<DemoSession | null> {
    try {
        const validation = await validateDemoLink(linkCode);
        if (!validation.valid || !validation.link) {
            logger.warn(`Invalid demo link attempt: ${linkCode}`, null, 'demoLinkService');
            return null;
        }
        
        const link = validation.link;
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Calculate session expiry (max 24 hours per session)
        const sessionDuration = Math.min(24, link.validForHours || 24);
        const expiresAt = Timestamp.fromDate(new Date(Date.now() + sessionDuration * 60 * 60 * 1000));
        
        const session: DemoSession = {
            id: sessionId,
            linkId: link.id,
            linkCode: link.linkCode,
            tenantId: link.tenantId,
            
            startedAt: Timestamp.now(),
            lastActivityAt: Timestamp.now(),
            expiresAt,
            
            tourCompleted: !link.includeTour, // If no tour, mark as completed
            visitedSections: [],
            actionsPerformed: [],
            currentStep: 0,
            totalSteps: getTourSteps(link.allowedScopes, link.tourLanguage).length,
            
            userName: userInfo?.name,
            userEmail: userInfo?.email,
            userPhone: userInfo?.phone,
            
            permissions: {
                level: link.permissionLevel,
                scopes: link.allowedScopes,
                canCreateRequests: link.canCreateRequests,
                canManageEmployees: link.canManageEmployees,
                canViewReports: link.canViewReports,
                canAccessSettings: link.canAccessSettings,
            },
            
            isActive: true,
        };
        
        // Save session
        await setDoc(doc(db, DEMO_SESSIONS_COLLECTION, sessionId), session);
        
        // Update link usage
        await updateDoc(doc(db, DEMO_LINKS_COLLECTION, link.id), {
            currentUses: increment(1),
            lastUsedAt: serverTimestamp(),
            usageHistory: [...link.usageHistory, {
                usedAt: Timestamp.now(),
                userAgent: navigator.userAgent,
                completedSteps: [],
            }]
        });
        
        // Seed demo data if needed (for demo link sessions)
        await seedDemoData(link.tenantId);
        
        logger.info(`Demo session started: ${sessionId}`, { linkCode }, 'demoLinkService');
        
        return session;
    } catch (error) {
        logger.error('Error starting demo session:', error, 'demoLinkService');
        return null;
    }
}

/**
 * Update session progress
 */
export async function updateSessionProgress(
    sessionId: string,
    updates: {
        visitedSection?: string;
        actionPerformed?: string;
        currentStep?: number;
        tourCompleted?: boolean;
    }
): Promise<void> {
    try {
        const sessionRef = doc(db, DEMO_SESSIONS_COLLECTION, sessionId);
        const sessionSnap = await getDoc(sessionRef);
        
        if (!sessionSnap.exists()) return;
        
        const session = sessionSnap.data() as DemoSession;
        const updateData: any = {
            lastActivityAt: serverTimestamp(),
        };
        
        if (updates.visitedSection && !session.visitedSections.includes(updates.visitedSection)) {
            updateData.visitedSections = [...session.visitedSections, updates.visitedSection];
        }
        
        if (updates.actionPerformed) {
            updateData.actionsPerformed = [...session.actionsPerformed, updates.actionPerformed];
        }
        
        if (updates.currentStep !== undefined) {
            updateData.currentStep = updates.currentStep;
        }
        
        if (updates.tourCompleted !== undefined) {
            updateData.tourCompleted = updates.tourCompleted;
        }
        
        await updateDoc(sessionRef, updateData);
    } catch (error) {
        logger.error('Error updating session:', error, 'demoLinkService');
    }
}

/**
 * Get active session
 */
export async function getActiveSession(sessionId: string): Promise<DemoSession | null> {
    try {
        const sessionRef = doc(db, DEMO_SESSIONS_COLLECTION, sessionId);
        const sessionSnap = await getDoc(sessionRef);
        
        if (!sessionSnap.exists()) return null;
        
        const session = sessionSnap.data() as DemoSession;
        
        // Check if expired
        if (session.expiresAt.toDate() < new Date()) {
            await updateDoc(sessionRef, { isActive: false });
            return null;
        }
        
        return session;
    } catch (error) {
        logger.error('Error getting session:', error, 'demoLinkService');
        return null;
    }
}

/**
 * End demo session
 */
export async function endDemoSession(sessionId: string, feedback?: string): Promise<void> {
    try {
        const sessionRef = doc(db, DEMO_SESSIONS_COLLECTION, sessionId);
        await updateDoc(sessionRef, {
            isActive: false,
            endedAt: serverTimestamp(),
            feedback,
        });
        
        logger.info(`Demo session ended: ${sessionId}`, null, 'demoLinkService');
    } catch (error) {
        logger.error('Error ending session:', error, 'demoLinkService');
    }
}

// ============================================================
// LINK MANAGEMENT
// ============================================================

/**
 * Get all demo links for a tenant
 */
export async function getDemoLinks(tenantId: string): Promise<DemoLinkConfig[]> {
    try {
        const linksRef = collection(db, DEMO_LINKS_COLLECTION);
        const q = query(linksRef, where('tenantId', '==', tenantId));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => doc.data() as DemoLinkConfig);
    } catch (error) {
        logger.error('Error getting demo links:', error, 'demoLinkService');
        return [];
    }
}

/**
 * Update demo link
 */
export async function updateDemoLink(
    linkId: string,
    updates: Partial<Pick<DemoLinkConfig, 
        'isActive' | 'isPaused' | 'maxUses' | 'validForHours' | 
        'permissionLevel' | 'allowedScopes' | 'canCreateRequests' | 
        'canManageEmployees' | 'canViewReports' | 'canAccessSettings'
    >>
): Promise<void> {
    try {
        const linkRef = doc(db, DEMO_LINKS_COLLECTION, linkId);
        
        // If validForHours changed, update expiresAt
        if (updates.validForHours !== undefined) {
            const linkSnap = await getDoc(linkRef);
            if (linkSnap.exists()) {
                const link = linkSnap.data() as DemoLinkConfig;
                updates = {
                    ...updates,
                    expiresAt: updates.validForHours > 0
                        ? Timestamp.fromDate(new Date(link.createdAt.toDate().getTime() + updates.validForHours * 60 * 60 * 1000))
                        : null
                } as any;
            }
        }
        
        await updateDoc(linkRef, updates as any);
        logger.info(`Demo link updated: ${linkId}`, updates, 'demoLinkService');
    } catch (error) {
        logger.error('Error updating demo link:', error, 'demoLinkService');
        throw error;
    }
}

/**
 * Delete demo link
 */
export async function deleteDemoLink(linkId: string): Promise<void> {
    try {
        await deleteDoc(doc(db, DEMO_LINKS_COLLECTION, linkId));
        logger.info(`Demo link deleted: ${linkId}`, null, 'demoLinkService');
    } catch (error) {
        logger.error('Error deleting demo link:', error, 'demoLinkService');
        throw error;
    }
}

// ============================================================
// TOUR STEPS
// ============================================================

/**
 * Get tour steps based on allowed scopes
 */
export function getTourSteps(scopes: DemoScope[], language: 'ar' | 'en'): TourStep[] {
    const allSteps: TourStep[] = [
        // Welcome
        {
            id: 'welcome',
            order: 1,
            targetSelector: 'body',
            title: 'مرحباً بك في أدورا!',
            titleEn: 'Welcome to Adora!',
            description: 'نظام إدارة الفنادق الذكي - سنأخذك في جولة سريعة لاستكشاف كل المميزات',
            descriptionEn: 'Smart Hotel Management System - Let\'s take a quick tour to explore all features',
            position: 'center',
            highlight: false,
            allowInteraction: false,
            section: 'all',
            icon: '🏨',
        },
        
        // Reception
        {
            id: 'reception-overview',
            order: 2,
            targetSelector: '[data-tour="reception-nav"]',
            title: 'لوحة الاستقبال',
            titleEn: 'Reception Dashboard',
            description: 'إدارة طلبات النزلاء، تتبع الغرف، وتنسيق العمل مع كل الأقسام',
            descriptionEn: 'Manage guest requests, track rooms, and coordinate with all departments',
            position: 'bottom',
            highlight: true,
            allowInteraction: true,
            section: 'reception',
            icon: '🛎️',
        },
        {
            id: 'reception-requests',
            order: 3,
            targetSelector: '[data-tour="requests-list"]',
            title: 'قائمة الطلبات',
            titleEn: 'Requests List',
            description: 'جميع طلبات النزلاء تظهر هنا - يمكنك تأكيدها، تحويلها، أو إتمامها',
            descriptionEn: 'All guest requests appear here - you can confirm, transfer, or complete them',
            position: 'right',
            highlight: true,
            allowInteraction: true,
            section: 'reception',
            icon: '📋',
        },
        {
            id: 'reception-quick-actions',
            order: 4,
            targetSelector: '[data-tour="quick-actions"]',
            title: 'الإجراءات السريعة',
            titleEn: 'Quick Actions',
            description: 'أنشئ طلبات جديدة بضغطة واحدة - تنظيف، صيانة، بيلمان، وأكثر',
            descriptionEn: 'Create new requests with one click - cleaning, maintenance, bellman, and more',
            position: 'bottom',
            highlight: true,
            allowInteraction: true,
            section: 'reception',
            icon: '⚡',
        },
        
        // Housekeeping
        {
            id: 'housekeeping-overview',
            order: 5,
            targetSelector: '[data-tour="housekeeping-nav"]',
            title: 'لوحة النظافة',
            titleEn: 'Housekeeping Dashboard',
            description: 'إدارة مهام التنظيف والتفتيش لكل الغرف',
            descriptionEn: 'Manage cleaning and inspection tasks for all rooms',
            position: 'bottom',
            highlight: true,
            allowInteraction: true,
            section: 'housekeeping',
            icon: '🧹',
        },
        {
            id: 'housekeeping-rooms',
            order: 6,
            targetSelector: '[data-tour="room-grid"]',
            title: 'شبكة الغرف',
            titleEn: 'Room Grid',
            description: 'عرض مرئي لحالة كل غرفة - جاهزة، قيد التنظيف، مشغولة',
            descriptionEn: 'Visual display of each room status - ready, cleaning, occupied',
            position: 'right',
            highlight: true,
            allowInteraction: true,
            section: 'housekeeping',
            icon: '🏠',
        },
        
        // Bellman
        {
            id: 'bellman-overview',
            order: 7,
            targetSelector: '[data-tour="bellman-nav"]',
            title: 'لوحة البيلمان',
            titleEn: 'Bellman Dashboard',
            description: 'تتبع طلبات الأمتعة وخدمات الضيافة',
            descriptionEn: 'Track luggage requests and hospitality services',
            position: 'bottom',
            highlight: true,
            allowInteraction: true,
            section: 'bellman',
            icon: '🧳',
        },
        
        // Maintenance
        {
            id: 'maintenance-overview',
            order: 8,
            targetSelector: '[data-tour="maintenance-nav"]',
            title: 'لوحة الصيانة',
            titleEn: 'Maintenance Dashboard',
            description: 'إدارة طلبات الإصلاح وجدولة الصيانة الوقائية',
            descriptionEn: 'Manage repair requests and schedule preventive maintenance',
            position: 'bottom',
            highlight: true,
            allowInteraction: true,
            section: 'maintenance',
            icon: '🔧',
        },
        
        // Admin
        {
            id: 'admin-overview',
            order: 9,
            targetSelector: '[data-tour="admin-nav"]',
            title: 'لوحة المدير',
            titleEn: 'Admin Dashboard',
            description: 'تقارير شاملة، إدارة الموظفين، وتخصيص النظام',
            descriptionEn: 'Comprehensive reports, employee management, and system customization',
            position: 'bottom',
            highlight: true,
            allowInteraction: true,
            section: 'admin',
            icon: '👔',
        },
        {
            id: 'admin-reports',
            order: 10,
            targetSelector: '[data-tour="reports-section"]',
            title: 'التقارير والإحصائيات',
            titleEn: 'Reports & Statistics',
            description: 'رسوم بيانية تفاعلية لأداء الفندق والموظفين',
            descriptionEn: 'Interactive charts for hotel and staff performance',
            position: 'left',
            highlight: true,
            allowInteraction: true,
            section: 'admin',
            icon: '📊',
        },
        {
            id: 'admin-employees',
            order: 11,
            targetSelector: '[data-tour="employees-section"]',
            title: 'إدارة الموظفين',
            titleEn: 'Employee Management',
            description: 'إضافة موظفين، تعيين أكواد دخول، وتتبع الأداء',
            descriptionEn: 'Add employees, assign login codes, and track performance',
            position: 'right',
            highlight: true,
            allowInteraction: true,
            section: 'admin',
            icon: '👥',
        },
        
        // Owner
        {
            id: 'owner-overview',
            order: 12,
            targetSelector: '[data-tour="owner-nav"]',
            title: 'لوحة المالك',
            titleEn: 'Owner Dashboard',
            description: 'إدارة الفروع، التراخيص، والتحكم الكامل في النظام',
            descriptionEn: 'Manage branches, licenses, and full system control',
            position: 'bottom',
            highlight: true,
            allowInteraction: true,
            section: 'owner',
            icon: '👑',
        },
        {
            id: 'owner-branches',
            order: 13,
            targetSelector: '[data-tour="branches-section"]',
            title: 'إدارة الفروع',
            titleEn: 'Branch Management',
            description: 'أضف فروعاً جديدة، خصص إعدادات كل فرع',
            descriptionEn: 'Add new branches, customize settings for each',
            position: 'right',
            highlight: true,
            allowInteraction: true,
            section: 'owner',
            icon: '🏢',
        },
        
        // Guest QR
        {
            id: 'guest-qr',
            order: 14,
            targetSelector: '[data-tour="guest-qr"]',
            title: 'نظام QR للنزلاء',
            titleEn: 'Guest QR System',
            description: 'يمكن للنزلاء طلب الخدمات مباشرة من جوالهم عبر مسح QR',
            descriptionEn: 'Guests can request services directly from their phone via QR scan',
            position: 'center',
            highlight: false,
            allowInteraction: false,
            section: 'all',
            icon: '📱',
        },
        
        // Completion
        {
            id: 'completion',
            order: 15,
            targetSelector: 'body',
            title: 'أنت جاهز!',
            titleEn: 'You\'re Ready!',
            description: 'استكشف النظام بحرية. لديك كل الصلاحيات لتجربة المميزات الكاملة.',
            descriptionEn: 'Explore the system freely. You have full permissions to try all features.',
            position: 'center',
            highlight: false,
            allowInteraction: false,
            section: 'all',
            icon: '🎉',
        },
    ];
    
    // Filter by allowed scopes
    if (!scopes.includes('all')) {
        return allSteps.filter(step => 
            step.section === 'all' || scopes.includes(step.section)
        );
    }
    
    return allSteps;
}

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get demo usage statistics
 */
export async function getDemoAnalytics(tenantId: string): Promise<{
    totalLinks: number;
    activeLinks: number;
    totalSessions: number;
    completedTours: number;
    averageSessionDuration: number;
    mostVisitedSections: { section: string; count: number }[];
    conversionRate: number;
}> {
    try {
        const links = await getDemoLinks(tenantId);
        
        // Get all sessions for these links
        const sessionsRef = collection(db, DEMO_SESSIONS_COLLECTION);
        const linkIds = links.map(l => l.id);
        let allSessions: DemoSession[] = [];
        
        // Query in batches (Firestore 'in' limit is 30)
        for (let i = 0; i < linkIds.length; i += 30) {
            const batch = linkIds.slice(i, i + 30);
            const q = query(sessionsRef, where('linkId', 'in', batch));
            const snapshot = await getDocs(q);
            allSessions.push(...snapshot.docs.map(doc => doc.data() as DemoSession));
        }
        
        // Calculate analytics
        const completedTours = allSessions.filter(s => s.tourCompleted).length;
        
        // Section visits
        const sectionCounts: Record<string, number> = {};
        allSessions.forEach(session => {
            session.visitedSections.forEach(section => {
                sectionCounts[section] = (sectionCounts[section] || 0) + 1;
            });
        });
        
        const mostVisitedSections = Object.entries(sectionCounts)
            .map(([section, count]) => ({ section, count }))
            .sort((a, b) => b.count - a.count);
        
        // Average session duration (in minutes)
        const durations = allSessions
            .filter(s => s.lastActivityAt)
            .map(s => (s.lastActivityAt.toDate().getTime() - s.startedAt.toDate().getTime()) / 60000);
        const averageSessionDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;
        
        return {
            totalLinks: links.length,
            activeLinks: links.filter(l => l.isActive && !l.isPaused).length,
            totalSessions: allSessions.length,
            completedTours,
            averageSessionDuration: Math.round(averageSessionDuration),
            mostVisitedSections,
            conversionRate: allSessions.length > 0 
                ? Math.round((completedTours / allSessions.length) * 100)
                : 0,
        };
    } catch (error) {
        logger.error('Error getting demo analytics:', error, 'demoLinkService');
        return {
            totalLinks: 0,
            activeLinks: 0,
            totalSessions: 0,
            completedTours: 0,
            averageSessionDuration: 0,
            mostVisitedSections: [],
            conversionRate: 0,
        };
    }
}

// ============================================================
// DEMO MODE UTILITIES
// ============================================================

/**
 * Check if current session is a demo
 */
export function isDemoSession(): boolean {
    return localStorage.getItem('adora_demo_session') !== null;
}

/**
 * Get current demo session from localStorage
 */
export function getCurrentDemoSession(): DemoSession | null {
    const stored = localStorage.getItem('adora_demo_session');
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Save demo session to localStorage
 */
export function saveDemoSessionLocally(session: DemoSession): void {
    localStorage.setItem('adora_demo_session', JSON.stringify(session));
}

/**
 * Clear demo session from localStorage
 */
export function clearDemoSessionLocally(): void {
    localStorage.removeItem('adora_demo_session');
}

/**
 * Check if action is allowed in demo mode
 */
export function isDemoActionAllowed(
    action: 'createRequest' | 'manageEmployees' | 'viewReports' | 'accessSettings',
    session: DemoSession | null
): boolean {
    if (!session) return true; // Not in demo mode
    
    switch (action) {
        case 'createRequest':
            return session.permissions.canCreateRequests;
        case 'manageEmployees':
            return session.permissions.canManageEmployees;
        case 'viewReports':
            return session.permissions.canViewReports;
        case 'accessSettings':
            return session.permissions.canAccessSettings;
        default:
            return true;
    }
}
