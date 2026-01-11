/**
 * Demo Security Service
 * Handles rate limiting, permission enforcement, and security checks for demo mode
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { logger } from './loggerService';
import { getCurrentDemoSession, DemoSession, DemoPermissionLevel } from './demoLinkService';

// ============================================================
// RATE LIMITING
// ============================================================

interface RateLimitRecord {
    attempts: number;
    firstAttempt: Timestamp;
    lastAttempt: Timestamp;
    blocked: boolean;
    blockedUntil?: Timestamp;
}

const RATE_LIMITS = {
    demoLinkAccess: {
        maxAttempts: 10,
        windowMinutes: 5,
        blockMinutes: 30,
    },
    demoActions: {
        maxAttempts: 50,
        windowMinutes: 1,
        blockMinutes: 5,
    },
    demoRequests: {
        maxAttempts: 20,
        windowMinutes: 1,
        blockMinutes: 10,
    },
};

/**
 * Get device/IP fingerprint for rate limiting
 */
export function getDemoFingerprint(): string {
    const userAgent = navigator.userAgent;
    const screenRes = `${screen.width}x${screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    
    // Create simple hash
    const str = `${userAgent}|${screenRes}|${timezone}|${language}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `demo_fp_${Math.abs(hash).toString(16)}`;
}

/**
 * Check and update rate limit for demo actions
 */
export async function checkDemoRateLimit(
    type: 'demoLinkAccess' | 'demoActions' | 'demoRequests',
    identifier?: string
): Promise<{ allowed: boolean; retryAfter?: number; message?: string }> {
    const limits = RATE_LIMITS[type];
    const fingerprint = identifier || getDemoFingerprint();
    const docId = `rate_limit_${type}_${fingerprint}`;
    
    try {
        const recordRef = doc(db, 'demoRateLimits', docId);
        const recordSnap = await getDoc(recordRef);
        const now = Timestamp.now();
        
        if (!recordSnap.exists()) {
            // First attempt
            await setDoc(recordRef, {
                attempts: 1,
                firstAttempt: now,
                lastAttempt: now,
                blocked: false,
            } as RateLimitRecord);
            return { allowed: true };
        }
        
        const record = recordSnap.data() as RateLimitRecord;
        
        // Check if currently blocked
        if (record.blocked && record.blockedUntil) {
            const blockedUntilMs = record.blockedUntil.toDate().getTime();
            if (blockedUntilMs > Date.now()) {
                const retryAfter = Math.ceil((blockedUntilMs - Date.now()) / 1000);
                return {
                    allowed: false,
                    retryAfter,
                    message: `تم حظرك مؤقتاً. حاول بعد ${Math.ceil(retryAfter / 60)} دقيقة`,
                };
            } else {
                // Block expired, reset
                await setDoc(recordRef, {
                    attempts: 1,
                    firstAttempt: now,
                    lastAttempt: now,
                    blocked: false,
                } as RateLimitRecord);
                return { allowed: true };
            }
        }
        
        // Check if window expired
        const windowMs = limits.windowMinutes * 60 * 1000;
        const windowStart = record.firstAttempt.toDate().getTime();
        
        if (Date.now() - windowStart > windowMs) {
            // Window expired, reset
            await setDoc(recordRef, {
                attempts: 1,
                firstAttempt: now,
                lastAttempt: now,
                blocked: false,
            } as RateLimitRecord);
            return { allowed: true };
        }
        
        // Check attempts
        if (record.attempts >= limits.maxAttempts) {
            // Block user
            const blockedUntil = Timestamp.fromDate(
                new Date(Date.now() + limits.blockMinutes * 60 * 1000)
            );
            await updateDoc(recordRef, {
                blocked: true,
                blockedUntil,
                lastAttempt: now,
            });
            
            logger.warn(`Demo rate limit exceeded: ${fingerprint}`, { type }, 'demoSecurityService');
            
            return {
                allowed: false,
                retryAfter: limits.blockMinutes * 60,
                message: `تجاوزت الحد المسموح. حاول بعد ${limits.blockMinutes} دقيقة`,
            };
        }
        
        // Increment attempts
        await updateDoc(recordRef, {
            attempts: increment(1),
            lastAttempt: now,
        });
        
        return { allowed: true };
    } catch (error) {
        logger.error('Rate limit check error:', error, 'demoSecurityService');
        // Allow on error to prevent lockout
        return { allowed: true };
    }
}

// ============================================================
// PERMISSION ENFORCEMENT
// ============================================================

export type DemoAction = 
    // Read-only actions (always allowed)
    | 'view_dashboard'
    | 'view_requests'
    | 'view_rooms'
    | 'view_employees'
    | 'view_reports'
    
    // Create actions
    | 'create_request'
    | 'create_employee'
    | 'create_room'
    
    // Modify actions
    | 'update_request'
    | 'update_employee'
    | 'update_room'
    | 'update_settings'
    
    // Delete actions (most restricted)
    | 'delete_request'
    | 'delete_employee'
    | 'delete_room'
    | 'delete_data';

const PERMISSION_MATRIX: Record<DemoPermissionLevel, DemoAction[]> = {
    viewer: [
        'view_dashboard',
        'view_requests',
        'view_rooms',
        'view_employees',
        'view_reports',
    ],
    tester: [
        'view_dashboard',
        'view_requests',
        'view_rooms',
        'view_employees',
        'view_reports',
        'create_request',
        'update_request',
    ],
    full_access: [
        'view_dashboard',
        'view_requests',
        'view_rooms',
        'view_employees',
        'view_reports',
        'create_request',
        'create_employee',
        'create_room',
        'update_request',
        'update_employee',
        'update_room',
        'update_settings',
        // Note: delete actions are NEVER allowed in demo
    ],
};

/**
 * Check if demo user can perform action
 */
export function canPerformDemoAction(action: DemoAction): {
    allowed: boolean;
    reason?: string;
} {
    const session = getCurrentDemoSession();
    
    // Not in demo mode = all actions allowed
    if (!session) {
        return { allowed: true };
    }
    
    const permissionLevel = session.permissions.level;
    const allowedActions = PERMISSION_MATRIX[permissionLevel];
    
    // DELETE actions are NEVER allowed in demo
    if (action.startsWith('delete_')) {
        return {
            allowed: false,
            reason: 'عمليات الحذف غير متاحة في وضع الديمو',
        };
    }
    
    // Check permission matrix
    if (!allowedActions.includes(action)) {
        return {
            allowed: false,
            reason: getPermissionDeniedMessage(action, permissionLevel),
        };
    }
    
    // Additional scope checks
    if (action.includes('employee') && !session.permissions.canManageEmployees) {
        return {
            allowed: false,
            reason: 'إدارة الموظفين غير متاحة في هذا الديمو',
        };
    }
    
    if (action.includes('request') && action !== 'view_requests' && !session.permissions.canCreateRequests) {
        return {
            allowed: false,
            reason: 'إنشاء الطلبات غير متاح في هذا الديمو',
        };
    }
    
    if (action.includes('settings') && !session.permissions.canAccessSettings) {
        return {
            allowed: false,
            reason: 'الإعدادات غير متاحة في هذا الديمو',
        };
    }
    
    return { allowed: true };
}

/**
 * Get user-friendly permission denied message
 */
function getPermissionDeniedMessage(action: DemoAction, level: DemoPermissionLevel): string {
    const actionNames: Record<string, string> = {
        'create_request': 'إنشاء الطلبات',
        'create_employee': 'إضافة الموظفين',
        'create_room': 'إضافة الغرف',
        'update_request': 'تعديل الطلبات',
        'update_employee': 'تعديل الموظفين',
        'update_room': 'تعديل الغرف',
        'update_settings': 'تغيير الإعدادات',
        'delete_request': 'حذف الطلبات',
        'delete_employee': 'حذف الموظفين',
        'delete_room': 'حذف الغرف',
        'delete_data': 'حذف البيانات',
    };
    
    const levelNames: Record<DemoPermissionLevel, string> = {
        viewer: 'المشاهد',
        tester: 'المختبر',
        full_access: 'الوصول الكامل',
    };
    
    const actionName = actionNames[action] || action;
    const levelName = levelNames[level];
    
    return `صلاحية "${actionName}" غير متاحة في وضع "${levelName}"`;
}

// ============================================================
// DEMO GUARD (HOC Helper)
// ============================================================

/**
 * Guard function to wrap actions with demo security checks
 */
export async function guardDemoAction<T>(
    action: DemoAction,
    callback: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string }> {
    // Check permission
    const permCheck = canPerformDemoAction(action);
    if (!permCheck.allowed) {
        return { success: false, error: permCheck.reason };
    }
    
    // Check rate limit
    const rateCheck = await checkDemoRateLimit('demoActions');
    if (!rateCheck.allowed) {
        return { success: false, error: rateCheck.message };
    }
    
    try {
        const result = await callback();
        return { success: true, result };
    } catch (error: any) {
        logger.error('Demo action error:', error, 'demoSecurityService');
        return { success: false, error: error.message || 'حدث خطأ غير متوقع' };
    }
}

// ============================================================
// IP BINDING (VIP Feature)
// ============================================================

interface IPBindingRecord {
    linkId: string;
    boundIP: string;
    boundAt: Timestamp;
    isVIP: boolean;
}

/**
 * Bind demo link to specific IP (for VIP clients)
 */
export async function bindDemoLinkToIP(
    linkId: string,
    ip: string
): Promise<void> {
    try {
        await setDoc(doc(db, 'demoIPBindings', linkId), {
            linkId,
            boundIP: ip,
            boundAt: Timestamp.now(),
            isVIP: true,
        } as IPBindingRecord);
        
        logger.info(`Demo link ${linkId} bound to IP ${ip}`, null, 'demoSecurityService');
    } catch (error) {
        logger.error('IP binding error:', error, 'demoSecurityService');
    }
}

/**
 * Check if IP is allowed for demo link
 */
export async function checkIPBinding(linkId: string): Promise<{
    isBound: boolean;
    allowed: boolean;
}> {
    try {
        const bindingRef = doc(db, 'demoIPBindings', linkId);
        const bindingSnap = await getDoc(bindingRef);
        
        if (!bindingSnap.exists()) {
            return { isBound: false, allowed: true };
        }
        
        // For VIP links, we would need server-side IP check
        // Client-side IP detection is unreliable
        // This would require a Cloud Function
        return { isBound: true, allowed: true };
    } catch (error) {
        return { isBound: false, allowed: true };
    }
}

// ============================================================
// DEMO WATERMARK
// ============================================================

/**
 * Generate demo watermark text
 */
export function getDemoWatermark(session: DemoSession | null): string | null {
    if (!session) return null;
    
    return `نسخة تجريبية - ${session.linkCode}`;
}

/**
 * Check if watermark should be shown
 */
export function shouldShowWatermark(): boolean {
    const session = getCurrentDemoSession();
    return session !== null;
}

// ============================================================
// SESSION VALIDATION
// ============================================================

/**
 * Validate current demo session
 */
export function validateDemoSession(): {
    valid: boolean;
    session: DemoSession | null;
    error?: string;
} {
    const session = getCurrentDemoSession();
    
    if (!session) {
        return { valid: true, session: null }; // Not in demo = valid
    }
    
    // Check expiry
    const expiresAt = session.expiresAt?.toDate?.() || new Date(session.expiresAt as any);
    if (expiresAt < new Date()) {
        return {
            valid: false,
            session: null,
            error: 'انتهت صلاحية جلسة الديمو',
        };
    }
    
    // Check if session is active
    if (!session.isActive) {
        return {
            valid: false,
            session: null,
            error: 'جلسة الديمو غير نشطة',
        };
    }
    
    return { valid: true, session };
}

// ============================================================
// LOGGING
// ============================================================

/**
 * Log demo security event
 */
export async function logDemoSecurityEvent(
    eventType: 'permission_denied' | 'rate_limited' | 'suspicious_activity' | 'session_expired',
    details: Record<string, any>
): Promise<void> {
    const session = getCurrentDemoSession();
    
    try {
        await setDoc(doc(db, 'demoSecurityLogs', `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`), {
            eventType,
            linkCode: session?.linkCode,
            sessionId: session?.id,
            fingerprint: getDemoFingerprint(),
            timestamp: Timestamp.now(),
            userAgent: navigator.userAgent,
            details,
        });
    } catch (error) {
        logger.error('Security log error:', error, 'demoSecurityService');
    }
}

export default {
    checkDemoRateLimit,
    canPerformDemoAction,
    guardDemoAction,
    validateDemoSession,
    getDemoWatermark,
    shouldShowWatermark,
    logDemoSecurityEvent,
};
