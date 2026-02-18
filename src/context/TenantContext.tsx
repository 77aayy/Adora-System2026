/**
 * Tenant Context
 * Manages current tenant (hotel) context for multi-tenant system
 * Adora Hotel Management System V3
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Tenant, TenantInfo } from '../types/tenant';
import { logger } from '../services/loggerService';

interface TenantContextType {
    tenantId: string | null;
    tenantInfo: TenantInfo | null;
    setTenant: (id: string) => Promise<void>;
    clearTenant: () => void;
    isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

interface TenantProviderProps {
    children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load tenant from localStorage on mount
    // ✅ FIX: Only load tenant if user is authenticated (check localStorage for user)
    useEffect(() => {
        const loadTenantFromStorage = () => {
            const storedUser = localStorage.getItem('adora_user');
            const storedTenantId = localStorage.getItem('adora_tenant_id');
            
            // Only load tenant if user is logged in (has user data in localStorage)
            if (storedUser && storedTenantId) {
                try {
                    const user = JSON.parse(storedUser);
                    // ✅ FIX: Always use tenantId from user object (not from localStorage directly)
                    // This ensures we use the correct tenantId for the current user
                    const userTenantId = user.tenantId || storedTenantId;
                    
                    // Only load tenant if user has tenantId (not owner)
                    if (userTenantId && userTenantId !== 'system-owner') {
                        // ✅ FIX: Only load if tenantId matches current user's tenantId
                        // This prevents loading old tenant data from previous sessions
                        if (userTenantId === storedTenantId) {
                            loadTenant(userTenantId);
                        } else {
                            // TenantId mismatch - clear and reload with correct one
                            localStorage.setItem('adora_tenant_id', userTenantId);
                            loadTenant(userTenantId);
                        }
                    } else if (user.role === 'owner' || userTenantId === 'system-owner') {
                        // Owner case - set system tenant immediately (no loading)
                        setTenantId('system-owner');
                        setTenantInfo({
                            name: 'النظام الرئيسي',
                            ownerId: 'owner',
                            ownerName: 'المالك',
                            plan: 'enterprise',
                            status: 'active',
                            createdAt: new Date() as any,
                            createdBy: 'system',
                            maxBranches: 999
                        } as any);
                        setIsLoading(false);
                    } else {
                        setIsLoading(false);
                    }
                } catch (e) {
                    console.error('Error parsing stored user:', e);
                    setIsLoading(false);
                }
            } else {
                // ✅ No user logged in - set loading false immediately
                setIsLoading(false);
            }
        };

        // ✅ Load immediately (synchronous check)
        loadTenantFromStorage();

        // ✅ FIX: Listen for tenant updates after login
        const handleTenantUpdate = (event: CustomEvent) => {
            const { tenantId } = event.detail;
            if (tenantId) {
                loadTenant(tenantId);
            }
        };

        window.addEventListener('tenant-update', handleTenantUpdate as EventListener);
        return () => {
            window.removeEventListener('tenant-update', handleTenantUpdate as EventListener);
        };
    }, []);

    const loadTenant = async (id: string) => {
        try {
            setIsLoading(true);

            // ✅ Special Case: Owner System Tenant
            if (id === 'system-owner') {
                setTenantId(id);
                setTenantInfo({
                    name: 'النظام الرئيسي',
                    ownerId: 'owner',
                    ownerName: 'المالك',
                    plan: 'enterprise',
                    status: 'active',
                    createdAt: new Date() as any,
                    createdBy: 'system',
                    maxBranches: 999
                } as any);
                setIsLoading(false);
                return;
            }

            // ✅ OPTIMIZED: Sign in anonymously and fetch tenant doc in parallel where possible
            const { signInAnonymously } = await import('firebase/auth');
            const { auth } = await import('../services/firebase');
            
            // ⚡ Only wait for auth if needed, otherwise proceed immediately
            const authPromise = auth.currentUser 
                ? Promise.resolve() 
                : signInAnonymously(auth).catch((authError: any) => {
                    logger.warn('Anonymous auth failed during tenant load (non-critical):', authError?.message, 'TenantContext');
                });

            // Wait for auth, then fetch tenant doc
            await authPromise;
            const tenantDoc = await getDoc(doc(db, 'tenants', id));

            if (tenantDoc.exists()) {
                const data = tenantDoc.data();
                setTenantId(id);
                const info = data.info as TenantInfo;
                setTenantInfo(info);
                localStorage.setItem('adora_tenant_id', id);

                // Save Organization Name for global access (e.g. printing)
                if (info?.name) {
                    localStorage.setItem('adora_org_name', info.name);
                }
            } else {
                logger.error('Tenant not found:', id, 'TenantContext');
                clearTenant();
            }
        } catch (error) {
            logger.error('Error loading tenant:', error, 'TenantContext');
            // ✅ Don't clear tenant on permission errors - might be temporary
            // Only clear if tenant truly doesn't exist
            if ((error as any)?.code !== 'permission-denied') {
                clearTenant();
            }
        } finally {
            setIsLoading(false);
        }
    };

    const setTenant = async (id: string) => {
        await loadTenant(id);
    };

    const clearTenant = () => {
        setTenantId(null);
        setTenantInfo(null);
        localStorage.removeItem('adora_tenant_id');
    };

    return (
        <TenantContext.Provider value={{
            tenantId,
            tenantInfo,
            setTenant,
            clearTenant,
            isLoading
        }}>
            {children}
        </TenantContext.Provider>
    );
};

/**
 * Hook to access tenant context
 */
export const useTenant = (): TenantContextType => {
    const context = useContext(TenantContext);
    if (!context) {
        throw new Error('useTenant must be used within TenantProvider');
    }
    return context;
};

/**
 * Hook to ensure tenant is loaded
 */
export const useRequireTenant = (): TenantContextType => {
    const context = useTenant();

    // ✅ FIX: Allow owner to bypass tenant check (as they operate cross-tenant)
    // We check localStorage directly to avoid circular dependency with AuthContext
    const storedUser = localStorage.getItem('adora_user');
    const isOwner = storedUser ? JSON.parse(storedUser).role === 'owner' : false;

    if (!context.tenantId && !isOwner) {
        // Only throw if NOT owner
        throw new Error('Tenant ID required but not set');
    }
    return context;
};
