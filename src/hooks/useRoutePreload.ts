/**
 * Route Preloading Hook
 * Adora Hotel Management System
 * 
 * ⚡ Preloads components and data when user hovers over navigation links
 * Dramatically improves perceived performance
 */

import { useCallback, useRef } from 'react';
import { preloadComponent, preloadComponents } from '../utils/lazyLoad';
import { prefetchData } from '../utils/dataCache';

// ============================================================
// ROUTE TO COMPONENT MAPPING
// ============================================================

const routeImports: Record<string, () => Promise<any>> = {
    '/reception': () => import('../features/reception/ReceptionDashboard'),
    '/housekeeping': () => import('../features/housekeeping/HousekeepingDashboard'),
    '/bellman': () => import('../features/bellman/BellmanDashboard'),
    '/maintenance': () => import('../features/maintenance/MaintenanceDashboard'),
    '/procurement': () => import('../features/procurement/ProcurementDashboard'),
    '/coffeeshop': () => import('../features/coffeeshop/CoffeeShopDashboard'),
    '/admin': () => import('../features/admin/AdminDashboard'),
    '/owner-dashboard': () => import('../features/super-admin/EnhancedOwnerDashboard'),
    '/guest': () => import('../features/guest/GuestDashboard'),
};

/** Preload chunk for a path immediately (no debounce). Call as soon as user is known to speed up first navigation. */
const preloadedPaths = new Set<string>();
export function preloadRouteByPath(path: string): void {
    if (!path || preloadedPaths.has(path)) return;
    const importFn = Object.entries(routeImports).find(([route]) => path.startsWith(route))?.[1];
    if (importFn) {
        preloadedPaths.add(path);
        preloadComponent(importFn);
    }
}

// ============================================================
// PRELOAD HOOK
// ============================================================

interface UseRoutePreloadReturn {
    /** Call on mouse enter to start preloading */
    preloadRoute: (path: string) => void;
    /** Get props to spread on link element */
    getPreloadProps: (path: string) => {
        onMouseEnter: () => void;
        onFocus: () => void;
    };
}

/**
 * Hook for preloading routes on hover/focus
 */
export function useRoutePreload(): UseRoutePreloadReturn {
    const preloadedRef = useRef<Set<string>>(new Set());
    const timeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

    const preloadRoute = useCallback((path: string) => {
        // Don't preload if already done
        if (preloadedRef.current.has(path)) return;

        // Debounce preloading (wait 100ms to avoid preloading on quick hover)
        if (timeoutRef.current[path]) {
            clearTimeout(timeoutRef.current[path]);
        }

        timeoutRef.current[path] = setTimeout(() => {
            if (preloadedPaths.has(path)) {
                preloadedRef.current.add(path);
                delete timeoutRef.current[path];
                return;
            }
            const importFn = Object.entries(routeImports).find(([route]) => 
                path.startsWith(route)
            )?.[1];

            if (importFn) {
                preloadComponent(importFn);
                preloadedPaths.add(path);
                preloadedRef.current.add(path);
                if (import.meta.env.DEV) console.log(`⚡ Preloaded: ${path}`);
            }

            delete timeoutRef.current[path];
        }, 100);
    }, []);

    const getPreloadProps = useCallback((path: string) => ({
        onMouseEnter: () => preloadRoute(path),
        onFocus: () => preloadRoute(path),
    }), [preloadRoute]);

    return { preloadRoute, getPreloadProps };
}

// ============================================================
// ADJACENT ROUTE PRELOADING
// ============================================================

const adjacentRoutes: Record<string, string[]> = {
    '/reception': ['/housekeeping', '/bellman', '/maintenance'],
    '/housekeeping': ['/reception', '/maintenance'],
    '/bellman': ['/reception', '/housekeeping'],
    '/maintenance': ['/reception', '/housekeeping'],
    '/procurement': ['/admin', '/reception'],
    '/admin': ['/reception', '/housekeeping', '/procurement'],
    '/owner-dashboard': ['/admin'],
};

/** Paths we've already scheduled adjacent preload for (avoid duplicate runs/logs). */
const adjacentPreloadedForPath = new Set<string>();

/**
 * Preload adjacent routes when a route loads
 * Call this after main component mounts. Runs at most once per path.
 */
export function preloadAdjacentRoutes(currentPath: string): void {
    const adjacent = adjacentRoutes[currentPath];
    if (!adjacent) return;
    if (adjacentPreloadedForPath.has(currentPath)) return;
    adjacentPreloadedForPath.add(currentPath);

    // Preload after a delay to not block main content
    setTimeout(() => {
        const imports = adjacent
            .map(path => routeImports[path])
            .filter(Boolean);
        
        if (imports.length > 0) {
            preloadComponents(imports);
            if (import.meta.env.DEV) {
                console.log(`⚡ Preloaded adjacent routes for ${currentPath}`);
            }
        }
    }, 2000); // Wait 2 seconds after main content loads
}

// ============================================================
// DATA PREFETCHING
// ============================================================

interface PrefetchConfig {
    tenantId?: string;
    branchId?: string;
}

/**
 * Prefetch data for a specific route
 */
export async function prefetchRouteData(path: string, config: PrefetchConfig): Promise<void> {
    const { tenantId, branchId } = config;
    
    if (!tenantId || !branchId) return;

    switch (path) {
        case '/reception':
            // Prefetch active requests
            prefetchData(
                `requests_${branchId}_active`,
                async () => {
                    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
                    const { getSafeFirestore } = await import('../services/firebase');
                    const db = await getSafeFirestore();
                    if (!db) return [];
                    
                    const q = query(
                        collection(db, 'tenants', tenantId, 'branches', branchId, 'requests'),
                        where('status', 'in', ['PENDING', 'CONFIRMED', 'IN_PROGRESS']),
                        orderBy('createdAt', 'desc'),
                        limit(50)
                    );
                    const snap = await getDocs(q);
                    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                },
                { ttl: 30 * 1000 } // 30 seconds
            );
            break;

        case '/housekeeping':
            // Prefetch room statuses
            prefetchData(
                `rooms_${branchId}_status`,
                async () => {
                    const { collection, getDocs } = await import('firebase/firestore');
                    const { getSafeFirestore } = await import('../services/firebase');
                    const db = await getSafeFirestore();
                    if (!db) return [];
                    
                    const snap = await getDocs(
                        collection(db, 'tenants', tenantId, 'branches', branchId, 'rooms')
                    );
                    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
                },
                { ttl: 60 * 1000 } // 1 minute
            );
            break;

        case '/admin':
            // Prefetch settings
            prefetchData(
                `settings_${tenantId}`,
                async () => {
                    const { getSystemSettings } = await import('../services/systemSettingsService');
                    return getSystemSettings();
                },
                { ttl: 5 * 60 * 1000 } // 5 minutes
            );
            break;
    }
}

// ============================================================
// VISIBILITY-BASED PRELOADING
// ============================================================

/**
 * Preload route when link becomes visible (for mobile/scroll)
 */
export function createVisibilityPreloader(): IntersectionObserver | null {
    if (typeof window === 'undefined') return null;

    return new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const path = (entry.target as HTMLElement).dataset.preloadPath;
                    if (path) {
                        const importFn = routeImports[path];
                        if (importFn) {
                            preloadComponent(importFn);
                        }
                    }
                }
            });
        },
        { rootMargin: '100px' } // Preload when within 100px of viewport
    );
}
