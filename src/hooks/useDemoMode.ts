/**
 * Demo Mode Hook
 * Provides demo-aware functionality for components
 * Handles permission checks, rate limiting, and watermarks
 * Adora Hotel Management System V3 - SaaS
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getCurrentDemoSession,
    isDemoSession,
    DemoSession,
    clearDemoSessionLocally,
    endDemoSession,
} from '../services/demoLinkService';
import {
    canPerformDemoAction,
    guardDemoAction,
    validateDemoSession,
    getDemoWatermark,
    checkDemoRateLimit,
    logDemoSecurityEvent,
    DemoAction,
} from '../services/demoSecurityService';
import { useUX } from '../context/UXContext';

// ============================================================
// TYPES
// ============================================================

interface DemoModeState {
    isDemo: boolean;
    session: DemoSession | null;
    permissionLevel: 'viewer' | 'tester' | 'full_access' | null;
    watermark: string | null;
    tourCompleted: boolean;
}

interface DemoModeActions {
    checkPermission: (action: DemoAction) => { allowed: boolean; reason?: string };
    guardAction: <T>(action: DemoAction, callback: () => Promise<T>) => Promise<{ success: boolean; result?: T; error?: string }>;
    exitDemo: () => Promise<void>;
    showDemoAlert: (action: string) => void;
}

// ============================================================
// HOOK
// ============================================================

export function useDemoMode(): DemoModeState & DemoModeActions {
    const { warning, error: showError, haptic } = useUX();
    
    const [state, setState] = useState<DemoModeState>({
        isDemo: false,
        session: null,
        permissionLevel: null,
        watermark: null,
        tourCompleted: false,
    });
    
    // Initialize demo state
    useEffect(() => {
        const checkDemo = () => {
            const validation = validateDemoSession();
            
            if (!validation.valid && validation.error) {
                // Session expired or invalid
                clearDemoSessionLocally();
                setState({
                    isDemo: false,
                    session: null,
                    permissionLevel: null,
                    watermark: null,
                    tourCompleted: false,
                });
                return;
            }
            
            const session = validation.session;
            
            setState({
                isDemo: !!session,
                session,
                permissionLevel: session?.permissions.level || null,
                watermark: getDemoWatermark(session),
                tourCompleted: session?.tourCompleted || false,
            });
        };
        
        checkDemo();
        
        // Re-check periodically
        const interval = setInterval(checkDemo, 60000);
        return () => clearInterval(interval);
    }, []);
    
    // Check permission
    const checkPermission = useCallback((action: DemoAction) => {
        return canPerformDemoAction(action);
    }, []);
    
    // Guard action with security checks
    const guardedAction = useCallback(async <T>(
        action: DemoAction,
        callback: () => Promise<T>
    ): Promise<{ success: boolean; result?: T; error?: string }> => {
        // First check permission
        const permCheck = canPerformDemoAction(action);
        if (!permCheck.allowed) {
            haptic('error');
            showError(permCheck.reason || 'الإجراء غير مسموح');
            
            // Log security event
            await logDemoSecurityEvent('permission_denied', {
                action,
                reason: permCheck.reason,
            });
            
            return { success: false, error: permCheck.reason };
        }
        
        // Check rate limit
        const rateCheck = await checkDemoRateLimit('demoActions');
        if (!rateCheck.allowed) {
            haptic('error');
            showError(rateCheck.message || 'تجاوزت الحد المسموح');
            
            await logDemoSecurityEvent('rate_limited', {
                action,
                retryAfter: rateCheck.retryAfter,
            });
            
            return { success: false, error: rateCheck.message };
        }
        
        // Execute action
        return guardDemoAction(action, callback);
    }, [haptic, showError]);
    
    // Show demo alert for blocked action
    const showDemoAlert = useCallback((action: string) => {
        warning(`🎭 وضع الديمو: ${action} غير متاح في هذه النسخة التجريبية`);
        haptic('error');
    }, [warning, haptic]);
    
    // Exit demo mode
    const exitDemo = useCallback(async () => {
        if (state.session) {
            await endDemoSession(state.session.id);
        }
        clearDemoSessionLocally();
        
        setState({
            isDemo: false,
            session: null,
            permissionLevel: null,
            watermark: null,
            tourCompleted: false,
        });
        
        // Redirect to login
        window.location.href = '/';
    }, [state.session]);
    
    return {
        ...state,
        checkPermission,
        guardAction: guardedAction,
        exitDemo,
        showDemoAlert,
    };
}

// ============================================================
// DEMO-AWARE COMPONENT HELPERS
// ============================================================

/**
 * Wrapper for demo-blocked actions
 * Use this to wrap onClick handlers
 */
export function withDemoGuard(
    action: DemoAction,
    callback: () => void | Promise<void>,
    onBlocked?: (reason: string) => void
): () => void {
    return () => {
        const check = canPerformDemoAction(action);
        if (!check.allowed) {
            if (onBlocked) {
                onBlocked(check.reason || 'غير مسموح');
            }
            return;
        }
        callback();
    };
}

/**
 * Hook for demo-aware delete confirmation
 */
export function useDemoDeleteGuard() {
    const { showDemoAlert, isDemo, checkPermission } = useDemoMode();
    
    return useCallback((entityType: string, onConfirm: () => void) => {
        if (isDemo) {
            const check = checkPermission('delete_data' as DemoAction);
            if (!check.allowed) {
                showDemoAlert(`حذف ${entityType}`);
                return;
            }
        }
        onConfirm();
    }, [isDemo, checkPermission, showDemoAlert]);
}

// ============================================================
// EXPORTS
// ============================================================

export default useDemoMode;
