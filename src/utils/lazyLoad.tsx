/**
 * Lazy Loading Utilities
 * Adora Hotel Management System V2
 */

import React, { lazy, Suspense, ComponentType, useState, useEffect, useRef } from 'react';
import { AdoraLoader } from '../components/common/AdoraLoader';

// ============================================================
// LAZY COMPONENT WRAPPER
// ============================================================

/**
 * Creates a lazy-loaded component with automatic loading fallback
 * ✅ With retry logic for failed dynamic imports (Vite hot reload issues)
 */
export function lazyLoad<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    fallback: React.ReactNode = null
) {
    // ✅ Retry logic for failed imports
    const retryImport = async (fn: () => Promise<{ default: T }>, retriesLeft = 3, delay = 1000): Promise<{ default: T }> => {
        try {
            return await fn();
        } catch (error: any) {
            // ✅ Check if it's a chunk loading error
            const isChunkError = error?.message?.includes('Failed to fetch') ||
                                error?.message?.includes('Loading chunk') ||
                                error?.message?.includes('dynamically imported module');
            
            if (isChunkError && retriesLeft > 0) {
                console.warn(`⚠️ Chunk load failed, retrying... (${retriesLeft} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return retryImport(fn, retriesLeft - 1, delay);
            }
            
            // ✅ If all retries failed, reload the page
            if (isChunkError && retriesLeft === 0) {
                console.error('❌ All retry attempts failed - reloading page');
                window.location.reload();
                throw error;
            }
            
            throw error;
        }
    };

    const LazyComponent = lazy(() => retryImport(importFn));

    const WrappedComponent = (props: React.ComponentProps<T>) => {
        return (
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900/20 to-slate-900">
                    {fallback || <AdoraLoader size="lg" message="جاري التحميل..." />}
                </div>
            }>
                <LazyComponent {...props} />
            </Suspense>
        );
    };

    return WrappedComponent;
}

// ============================================================
// PRELOAD UTILITIES
// ============================================================

/**
 * Preload a component before navigation
 */
export function preloadComponent(
    importFn: () => Promise<{ default: ComponentType<any> }>
): void {
    importFn();
}

/**
 * Preload multiple components
 */
export function preloadComponents(
    importFns: Array<() => Promise<{ default: ComponentType<any> }>>
): void {
    importFns.forEach(fn => fn());
}

// ============================================================
// ROUTE-BASED LAZY LOADING
// ============================================================

/**
 * Lazy load features by route
 */
export const LazyFeatures = {
    // Admin features
    AdminDashboard: lazy(() => import('../features/admin/AdminDashboard')),
    OwnerPanel: lazy(() => import('../features/admin/OwnerPanel')),

    // Department features
    ReceptionDashboard: lazy(() => import('../features/reception/ReceptionDashboard')),
    HousekeepingDashboard: lazy(() => import('../features/housekeeping/HousekeepingDashboard')),
    BellmanDashboard: lazy(() => import('../features/bellman/BellmanDashboard')),
    MaintenanceDashboard: lazy(() => import('../features/maintenance/MaintenanceDashboard')),
    ProcurementDashboard: lazy(() => import('../features/procurement/ProcurementDashboard')),

    // Guest features
    GuestDashboard: lazy(() => import('../features/guest/GuestDashboard')),

    // Auth
    LoginScreen: lazy(() => import('../features/auth/LoginScreen')),
};

// ============================================================
// INTERSECTION OBSERVER LAZY LOADING
// ============================================================

interface IntersectionLazyResult<T> {
    ref: React.RefObject<HTMLDivElement | null>;
    loaded: boolean;
    data: T | null;
}

/**
 * Load component when it enters viewport
 */
export function useIntersectionLazy<T>(
    importFn: () => Promise<T>,
    options?: IntersectionObserverInit
): IntersectionLazyResult<T> {
    const [loaded, setLoaded] = useState(false);
    const [data, setData] = useState<T | null>(null);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !loaded) {
                    importFn().then(result => {
                        setData(result);
                        setLoaded(true);
                    });
                    observer.disconnect();
                }
            },
            { threshold: 0.1, ...options }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [importFn, loaded, options]);

    return { ref, loaded, data };
}
