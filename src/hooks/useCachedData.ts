/**
 * React Hook for Cached Data
 * Integrates cacheService with React components
 * Adora Hotel Management System - SaaS
 * 
 * ✅ SAFE: Pure addition, doesn't modify existing code
 * ✅ USAGE: Replace direct Firestore calls with this hook for caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCachedData, invalidateCache, getFromCache, CACHE_TTL } from '../services/cacheService';

// ============================================================
// TYPES
// ============================================================

interface UseCachedDataOptions {
    /** Time to live in milliseconds */
    ttl?: number;
    /** Skip cache and always fetch fresh data */
    skipCache?: boolean;
    /** Enable real-time updates (bypasses cache) */
    realtime?: boolean;
    /** Dependencies that trigger refetch when changed */
    deps?: any[];
}

interface UseCachedDataResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    isCached: boolean;
}

// ============================================================
// MAIN HOOK
// ============================================================

/**
 * Hook for fetching and caching data
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const { data: rooms, loading, refresh } = useCachedData(
 *   `rooms_${tenantId}_${branchId}`,
 *   () => fetchRooms(tenantId, branchId),
 *   { ttl: CACHE_TTL.ROOMS }
 * );
 * 
 * // With dependencies (refetch when branchId changes)
 * const { data: rooms } = useCachedData(
 *   `rooms_${tenantId}_${branchId}`,
 *   () => fetchRooms(tenantId, branchId),
 *   { ttl: CACHE_TTL.ROOMS, deps: [branchId] }
 * );
 * ```
 */
export function useCachedData<T>(
    cacheKey: string,
    fetcher: () => Promise<T>,
    options: UseCachedDataOptions = {}
): UseCachedDataResult<T> {
    const {
        ttl = CACHE_TTL.REQUESTS,
        skipCache = false,
        deps = [],
    } = options;
    
    const [data, setData] = useState<T | null>(() => {
        // Try to get initial data from cache synchronously
        if (!skipCache) {
            return getFromCache<T>(cacheKey);
        }
        return null;
    });
    const [loading, setLoading] = useState(!data);
    const [error, setError] = useState<Error | null>(null);
    const [isCached, setIsCached] = useState(!!data);
    
    // Track if component is mounted
    const isMounted = useRef(true);
    
    // Fetch function
    const fetchData = useCallback(async (forceRefresh: boolean = false) => {
        try {
            setLoading(true);
            setError(null);
            
            let result: T;
            
            if (skipCache || forceRefresh) {
                // Bypass cache
                result = await fetcher();
            } else {
                // Use cache
                result = await getCachedData(cacheKey, fetcher, ttl);
            }
            
            if (isMounted.current) {
                setData(result);
                setIsCached(!forceRefresh && !skipCache);
            }
        } catch (err) {
            if (isMounted.current) {
                setError(err as Error);
                console.error(`Error fetching ${cacheKey}:`, err);
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
            }
        }
    }, [cacheKey, fetcher, ttl, skipCache]);
    
    // Manual refresh (bypasses cache)
    const refresh = useCallback(async () => {
        invalidateCache(cacheKey);
        await fetchData(true);
    }, [cacheKey, fetchData]);
    
    // Initial fetch and dependency changes
    useEffect(() => {
        isMounted.current = true;
        fetchData();
        
        return () => {
            isMounted.current = false;
        };
    }, [cacheKey, ...deps]);
    
    return { data, loading, error, refresh, isCached };
}

// ============================================================
// SPECIALIZED HOOKS
// ============================================================

/**
 * Hook for rooms data with caching
 */
export function useCachedRooms(
    tenantId: string | undefined,
    branchId: string | undefined,
    fetcher: () => Promise<any[]>
) {
    return useCachedData(
        `rooms_${tenantId}_${branchId}`,
        fetcher,
        { 
            ttl: CACHE_TTL.ROOMS,
            deps: [tenantId, branchId]
        }
    );
}

/**
 * Hook for employees data with caching
 */
export function useCachedEmployees(
    tenantId: string | undefined,
    branchId: string | undefined,
    fetcher: () => Promise<any[]>
) {
    return useCachedData(
        `employees_${tenantId}_${branchId}`,
        fetcher,
        { 
            ttl: CACHE_TTL.EMPLOYEES,
            deps: [tenantId, branchId]
        }
    );
}

/**
 * Hook for settings data with caching
 */
export function useCachedSettings(
    tenantId: string | undefined,
    fetcher: () => Promise<any>
) {
    return useCachedData(
        `settings_${tenantId}`,
        fetcher,
        { 
            ttl: CACHE_TTL.SETTINGS,
            deps: [tenantId]
        }
    );
}

/**
 * Hook for statistics with caching
 */
export function useCachedStats(
    tenantId: string | undefined,
    branchId: string | undefined,
    fetcher: () => Promise<any>
) {
    return useCachedData(
        `stats_${tenantId}_${branchId}`,
        fetcher,
        { 
            ttl: CACHE_TTL.STATS,
            deps: [tenantId, branchId]
        }
    );
}

// ============================================================
// PREFETCH HOOK
// ============================================================

/**
 * Hook to prefetch data when component mounts
 * Useful for preloading data before user navigates
 * 
 * @example
 * ```typescript
 * // In Dashboard, prefetch data for common operations
 * usePrefetch([
 *   { key: `rooms_${tenantId}`, fetcher: fetchRooms, ttl: CACHE_TTL.ROOMS },
 *   { key: `employees_${tenantId}`, fetcher: fetchEmployees, ttl: CACHE_TTL.EMPLOYEES },
 * ]);
 * ```
 */
export function usePrefetch(
    items: Array<{ key: string; fetcher: () => Promise<any>; ttl: number }>
) {
    useEffect(() => {
        // Prefetch in background
        items.forEach(async ({ key, fetcher, ttl }) => {
            // Only prefetch if not already cached
            if (!getFromCache(key)) {
                try {
                    await getCachedData(key, fetcher, ttl);
                } catch (err) {
                    console.warn(`Failed to prefetch ${key}:`, err);
                }
            }
        });
    }, []);
}

export default useCachedData;
