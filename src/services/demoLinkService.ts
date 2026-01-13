/**
 * Demo Link Service - V2 (Simplified)
 * ====================================
 * إدارة روابط الديمو للمشتركين التجريبيين
 * - Firebase منفصل لكل ديمو
 * - بدون دفع أو فواتير
 * - رقم واتس للمبيعات
 * 
 * @author Adora System
 * @version 2.0
 */

import { db } from './firebase';
import {
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
    query, where, getDocs, Timestamp, serverTimestamp, increment
} from 'firebase/firestore';
import { logger } from './loggerService';

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
    linkCode: string;
    linkUrl: string;
    
    // Permissions
    permissionLevel: DemoPermissionLevel;
    allowedScopes: DemoScope[];
    canCreateRequests: boolean;
    canManageEmployees: boolean;
    canViewReports: boolean;
    canAccessSettings: boolean;
    
    // Limits
    maxUses: number;
    currentUses: number;
    expiresAt: Timestamp | null;
    validForHours: number;
    
    // 🎭 Sandbox Mode
    isSandboxMode: boolean;
    sandboxLimits?: {
        maxBranches: number;
        maxEmployeesPerBranch: number;
        maxRoomsPerBranch: number;
    };
    
    // 🔥 Demo Firebase Config
    demoFirebaseConfig?: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId: string;
        appId: string;
    };
    
    // 📱 رقم المبيعات (WhatsApp)
    salesWhatsAppNumber?: string;
    
    // 👤 بيانات المدير التجريبي
    demoManager?: {
        name: string;
        code: string;
        branchName: string;
    };
    
    // Tracking
    createdAt: Timestamp;
    lastUsedAt?: Timestamp;
    usageHistory: DemoUsage[];
    
    // Status
    isActive: boolean;
    isPaused: boolean;
    
    // Legacy fields (for compatibility)
    includeTour?: boolean;
    tourLanguage?: 'ar' | 'en';
    showWatermark?: boolean;
    multiLicense?: boolean;
    licensesCount?: number;
    branchesPerLicense?: number;
}

export interface DemoUsage {
    usedAt: Timestamp;
    userAgent: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    completedSteps: string[];
    feedbackGiven?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEMO_LINKS_COLLECTION = 'demoLinks';
const DEFAULT_EXPIRY_HOURS = 168; // أسبوع
const DEFAULT_MAX_USES = 100;

// ============================================================
// LINK GENERATION
// ============================================================

/**
 * Generate a unique demo link code
 */
function generateLinkCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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
        
        const baseUrl = window.location.origin;
        const linkUrl = `${baseUrl}/demo/${linkCode}`;
        
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
            permissionLevel: config.permissionLevel || 'full_access',
            allowedScopes: config.allowedScopes || ['all'],
            canCreateRequests: config.canCreateRequests ?? true,
            canManageEmployees: config.canManageEmployees ?? true,
            canViewReports: config.canViewReports ?? true,
            canAccessSettings: config.canAccessSettings ?? true,
            
            // Limits
            maxUses: config.maxUses ?? DEFAULT_MAX_USES,
            currentUses: 0,
            expiresAt,
            validForHours,
            
            // 🎭 Sandbox Mode
            isSandboxMode: config.isSandboxMode ?? true,
            sandboxLimits: config.sandboxLimits ?? {
                maxBranches: 10,
                maxEmployeesPerBranch: 20,
                maxRoomsPerBranch: 50,
            },
            
            // 🔥 Demo Firebase Config
            demoFirebaseConfig: config.demoFirebaseConfig,
            
            // 📱 Sales WhatsApp
            salesWhatsAppNumber: config.salesWhatsAppNumber,
            
            // 👤 Demo Manager
            demoManager: config.demoManager,
            
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
        
        if (snapshot.empty) {
            return null;
        }
        
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
export async function deleteDemoLink(linkId: string, alsoWipeSandbox: boolean = true): Promise<{
    success: boolean;
    sandboxWiped?: boolean;
    wipedData?: any;
    error?: string;
}> {
    try {
        const linkRef = doc(db, DEMO_LINKS_COLLECTION, linkId);
        const linkSnap = await getDoc(linkRef);
        
        if (!linkSnap.exists()) {
            return { success: false, error: 'الرابط غير موجود' };
        }
        
        const linkData = linkSnap.data() as DemoLinkConfig;
        
        // 🧹 مسح بيانات Firebase الديمو إذا طُلب ذلك
        let wipedData = null;
        let sandboxWiped = false;
        
        if (alsoWipeSandbox && linkData.isSandboxMode && linkData.demoFirebaseConfig) {
            logger.info(`🗑️ Wiping demo Firebase data for: ${linkData.linkCode}`, null, 'demoLinkService');
            
            try {
                // استيراد الوظيفة من firebaseMulti
                const { wipeDemoFirebaseData } = await import('./firebaseMulti');
                
                const wipeResult = await wipeDemoFirebaseData(
                    linkData.demoFirebaseConfig,
                    linkData.linkCode
                );
                
                if (wipeResult.success) {
                    wipedData = wipeResult.deleted;
                    sandboxWiped = true;
                    logger.info(`✅ Demo Firebase wiped successfully!`, wipeResult.deleted, 'demoLinkService');
                } else {
                    logger.warn(`⚠️ Failed to wipe demo Firebase: ${wipeResult.error}`, null, 'demoLinkService');
                }
            } catch (wipeError: any) {
                logger.warn(`⚠️ Could not wipe demo Firebase: ${wipeError.message}`, null, 'demoLinkService');
                // لا نوقف العملية - نكمل حذف الرابط
            }
        }
        
        // Delete the link from main Firebase
        await deleteDoc(linkRef);
        logger.info(`Demo link deleted: ${linkId}`, { sandboxWiped, wipedData }, 'demoLinkService');
        
        return { 
            success: true,
            sandboxWiped,
            wipedData 
        };
    } catch (error: any) {
        logger.error('Error deleting demo link:', error, 'demoLinkService');
        throw error;
    }
}

/**
 * Record demo link usage
 */
export async function recordDemoUsage(linkCode: string): Promise<void> {
    try {
        const link = await getDemoLinkByCode(linkCode);
        if (!link) return;
        
        await updateDoc(doc(db, DEMO_LINKS_COLLECTION, link.id), {
            currentUses: increment(1),
            lastUsedAt: serverTimestamp(),
            usageHistory: [...link.usageHistory, {
                usedAt: Timestamp.now(),
                userAgent: navigator.userAgent,
                completedSteps: [],
            }]
        });
    } catch (error) {
        logger.error('Error recording demo usage:', error, 'demoLinkService');
    }
}

/**
 * Get demo analytics
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
        
        const totalSessions = links.reduce((sum, link) => sum + link.currentUses, 0);
        
        return {
            totalLinks: links.length,
            activeLinks: links.filter(l => l.isActive && !l.isPaused).length,
            totalSessions,
            completedTours: 0,
            averageSessionDuration: 0,
            mostVisitedSections: [],
            conversionRate: 0,
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
    return localStorage.getItem('adora_demo_code') !== null;
}

/**
 * Get current demo code from localStorage
 */
export function getCurrentDemoCode(): string | null {
    return localStorage.getItem('adora_demo_code');
}

/**
 * Save demo code to localStorage
 */
export function saveDemoCode(code: string): void {
    localStorage.setItem('adora_demo_code', code);
}

/**
 * Clear demo code from localStorage
 */
export function clearDemoCode(): void {
    localStorage.removeItem('adora_demo_code');
}
