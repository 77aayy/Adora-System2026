/**
 * Branch Status Guard
 * Blocks access to branches scheduled for deletion
 * SaaS-compatible: Handles all data types safely
 * ✅ CRITICAL: Owner should NEVER be blocked - they access all branches dynamically
 */

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Lock, AlertTriangle } from 'lucide-react';

// ✅ SAFE STRING EXTRACTION - Outside component to avoid re-creation
function safeExtractString(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return String(value);
    
    // For objects, only try to access known properties - never convert the whole object
    if (typeof value === 'object' && value !== null) {
        const obj = value as Record<string, unknown>;
        
        // Try common ID fields
        const fields = ['id', 'branchId', 'tenantId', 'branch_id', 'tenant_id', 'code', 'key'];
        for (const field of fields) {
            const val = obj[field];
            if (val !== null && val !== undefined) {
                if (typeof val === 'string') return val.trim() || null;
                if (typeof val === 'number') return String(val);
            }
        }
    }
    
    return null;
}

// ✅ SAFE ROLE EXTRACTION
function safeExtractRole(user: unknown): string | null {
    if (!user || typeof user !== 'object') return null;
    try {
        const userObj = user as Record<string, unknown>;
        const role = userObj.role;
        if (typeof role === 'string') return role;
        return null;
    } catch {
        return null;
    }
}

export const BranchStatusGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ✅ Get context values - hooks must be called unconditionally
    const authContext = useAuth();
    const tenantContext = useTenant();
    
    // ✅ Extract primitives IMMEDIATELY - no hooks after this
    const user = authContext?.user ?? null;
    const rawBranchId = authContext?.branchId ?? null;
    const rawTenantId = tenantContext?.tenantId ?? null;
    
    // ✅ Convert to primitives using safe functions
    const userRole = safeExtractRole(user);
    const branchIdStr = safeExtractString(rawBranchId);
    const tenantIdStr = safeExtractString(rawTenantId);
    
    // State
    const [isSuspended, setIsSuspended] = useState(false);
    const [loading, setLoading] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);
    
    // ✅ Store previous values to detect changes (avoid object comparison)
    const prevBranchIdRef = useRef<string | null>(null);
    const prevTenantIdRef = useRef<string | null>(null);
    const prevRoleRef = useRef<string | null>(null);
    
    // ✅ Single useEffect with primitive dependencies only
    useEffect(() => {
        // Check if values actually changed (using refs to avoid object comparison)
        const branchIdChanged = prevBranchIdRef.current !== branchIdStr;
        const tenantIdChanged = prevTenantIdRef.current !== tenantIdStr;
        const roleChanged = prevRoleRef.current !== userRole;
        
        // Update refs
        prevBranchIdRef.current = branchIdStr;
        prevTenantIdRef.current = tenantIdStr;
        prevRoleRef.current = userRole;
        
        // Cleanup previous subscription
        if (unsubscribeRef.current) {
            try {
                unsubscribeRef.current();
            } catch (e) {
                console.error('Error unsubscribing:', e);
            }
            unsubscribeRef.current = null;
        }

        // ✅ CRITICAL: Owner should NEVER be blocked - they access all branches dynamically
        // Owner doesn't have a branchId, so they should always pass through
        if (userRole === 'owner' || userRole === 'manager') {
            setIsSuspended(false);
            setLoading(false);
            return;
        }

        // Early return if branchId or tenantId are not valid strings
        if (!branchIdStr || !tenantIdStr) {
            setIsSuspended(false);
            setLoading(false);
            return;
        }

        // Only setup listener if values changed
        if (!branchIdChanged && !tenantIdChanged && !roleChanged) {
            return;
        }

        // Real-time listener for Branch Status
        try {
            // ✅ Ensure both are strings before calling doc()
            if (typeof tenantIdStr !== 'string' || typeof branchIdStr !== 'string') {
                console.warn('Invalid tenantId or branchId types');
                setIsSuspended(false);
                setLoading(false);
                return;
            }
            
            // ✅ Ensure db is not null
            if (!db) {
                console.warn('Firebase db is not initialized');
                setIsSuspended(false);
                setLoading(false);
                return;
            }
            
            const branchRef = doc(db, 'tenants', tenantIdStr, 'branches', branchIdStr);
            
            const unsubscribe = onSnapshot(
                branchRef,
                (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setIsSuspended(data?.status === 'scheduled_for_deletion');
                    } else {
                        setIsSuspended(false);
                    }
                    setLoading(false);
                },
                (error) => {
                    console.error('BranchStatusGuard error:', error);
                    setIsSuspended(false);
                    setLoading(false);
                }
            );

            unsubscribeRef.current = unsubscribe;
            
            return () => {
                if (unsubscribeRef.current) {
                    try {
                        unsubscribeRef.current();
                    } catch (e) {
                        console.error('Error in cleanup:', e);
                    }
                    unsubscribeRef.current = null;
                }
            };
        } catch (error) {
            console.error('BranchStatusGuard setup error:', error);
            setIsSuspended(false);
            setLoading(false);
            return undefined;
        }
    }, [userRole, branchIdStr, tenantIdStr]); // ✅ Only primitive values

    // Render
    if (loading) return null;

    if (isSuspended) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center p-4">
                <div className="max-w-md w-full glass rounded-3xl p-8 text-center border-t border-red-500/20">
                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Lock className="w-10 h-10 text-red-500" />
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">
                        الفرع موقوف مؤقتاً
                    </h1>

                    <p className="text-white/60 mb-8 leading-relaxed">
                        عفواً، هذا الفرع مجدول للحذف ولا يمكن إجراء أي عمليات عليه حالياً.
                        <br />
                        يرجى مراجعة إدارة الفندق للاستعادة.
                    </p>

                    <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10 flex items-start gap-3 text-right">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-red-300">
                            جميع العمليات (طلبات، دخول، تقارير) متوقفة تماماً لهذا الفرع حتى إشعار آخر.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
