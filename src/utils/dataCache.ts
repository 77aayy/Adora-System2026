/**
 * Data Caching Utility
 * Adora Hotel Management System
 * 
 * ⚡ Performance optimization layer for reducing Firebase reads
 * Uses localStorage with TTL for persistent caching
 */

// ============================================================
// TYPES
// ============================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    version: string;
}

interface CacheConfig {
    /** Time-to-live in milliseconds (default: 5 minutes) */
    ttl?: number;
    /** Storage type: 'local' | 'session' | 'memory' */
    storage?: 'local' | 'session' | 'memory';
    /** Cache version for invalidation */
    version?: string;
}

// ============================================================
// CACHE STORAGE
// ============================================================

const memoryCache = new Map<string, CacheEntry<any>>();
const CACHE_PREFIX = 'adora_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = '1.0.0';

// ============================================================
// CORE CACHE FUNCTIONS
// ============================================================

/**
 * Get cache storage based on config
 */
function getStorage(storageType: 'local' | 'session' | 'memory' = 'memory'): Storage | Map<string, CacheEntry<any>> | null {
    if (storageType === 'memory') return memoryCache;
    if (typeof window === 'undefined') return null;
    return storageType === 'local' ? localStorage : sessionStorage;
}

/**
 * Set data in cache
 */
export function setCache<T>(key: string, data: T, config: CacheConfig = {}): void {
    const { ttl = DEFAULT_TTL, storage = 'memory', version = CACHE_VERSION } = config;
    const cacheKey = `${CACHE_PREFIX}${key}`;
    
    const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        version
    };

    const storageTarget = getStorage(storage);
    
    if (storageTarget instanceof Map) {
        storageTarget.set(cacheKey, entry);
    } else if (storageTarget) {
        try {
            storageTarget.setItem(cacheKey, JSON.stringify(entry));
        } catch (e) {
            // Storage full - clear old entries
            clearExpiredCache(storage);
            try {
                storageTarget.setItem(cacheKey, JSON.stringify(entry));
            } catch {
                console.warn('Cache storage full, using memory cache');
                memoryCache.set(cacheKey, entry);
            }
        }
    }
}

/**
 * Get data from cache
 * Returns null if expired or not found
 */
export function getCache<T>(key: string, config: CacheConfig = {}): T | null {
    const { storage = 'memory', version = CACHE_VERSION } = config;
    const cacheKey = `${CACHE_PREFIX}${key}`;
    
    const storageTarget = getStorage(storage);
    let entry: CacheEntry<T> | null = null;

    if (storageTarget instanceof Map) {
        entry = storageTarget.get(cacheKey) || null;
    } else if (storageTarget) {
        try {
            const stored = storageTarget.getItem(cacheKey);
            if (stored) {
                entry = JSON.parse(stored) as CacheEntry<T>;
            }
        } catch {
            return null;
        }
    }

    if (!entry) return null;

    // Check version
    if (entry.version !== version) {
        removeCache(key, { storage });
        return null;
    }

    // Check TTL
    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
        removeCache(key, { storage });
        return null;
    }

    return entry.data;
}

/**
 * Remove specific cache entry
 */
export function removeCache(key: string, config: Pick<CacheConfig, 'storage'> = {}): void {
    const { storage = 'memory' } = config;
    const cacheKey = `${CACHE_PREFIX}${key}`;
    
    const storageTarget = getStorage(storage);
    
    if (storageTarget instanceof Map) {
        storageTarget.delete(cacheKey);
    } else if (storageTarget) {
        storageTarget.removeItem(cacheKey);
    }
}

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
    // Clear memory cache
    memoryCache.clear();
    
    // Clear localStorage cache
    if (typeof window !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Clear sessionStorage cache
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX)) {
                sessionKeysToRemove.push(key);
            }
        }
        sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(storageType: 'local' | 'session' | 'memory' = 'memory'): void {
    if (storageType === 'memory') {
        const now = Date.now();
        memoryCache.forEach((entry, key) => {
            if (now - entry.timestamp > entry.ttl) {
                memoryCache.delete(key);
            }
        });
        return;
    }

    if (typeof window === 'undefined') return;
    
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
            try {
                const entry = JSON.parse(storage.getItem(key) || '{}') as CacheEntry<any>;
                if (Date.now() - entry.timestamp > entry.ttl) {
                    keysToRemove.push(key);
                }
            } catch {
                keysToRemove.push(key);
            }
        }
    }
    
    keysToRemove.forEach(key => storage.removeItem(key));
}

// ============================================================
// SMART CACHE FETCH (Stale-While-Revalidate Pattern)
// ============================================================

/**
 * Smart fetch with cache
 * Returns cached data immediately if available, then revalidates in background
 */
export async function smartFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig & { 
        staleTime?: number;  // Time before background revalidation (default: 30s)
        onRevalidate?: (newData: T) => void;
    } = {}
): Promise<T> {
    const { 
        ttl = DEFAULT_TTL, 
        storage = 'local',
        staleTime = 30 * 1000,  // 30 seconds
        onRevalidate
    } = config;
    
    const cacheKey = key;
    const cached = getCache<{ data: T; fetchTime: number }>(cacheKey, { storage, ttl });
    
    // If we have cached data
    if (cached) {
        const isStale = Date.now() - cached.fetchTime > staleTime;
        
        // If stale, revalidate in background
        if (isStale && onRevalidate) {
            fetcher().then(newData => {
                setCache(cacheKey, { data: newData, fetchTime: Date.now() }, { storage, ttl });
                onRevalidate(newData);
            }).catch(console.error);
        }
        
        return cached.data;
    }
    
    // No cache, fetch fresh data
    const data = await fetcher();
    setCache(cacheKey, { data, fetchTime: Date.now() }, { storage, ttl });
    return data;
}

// ============================================================
// REACT HOOK FOR CACHED DATA
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseCachedDataOptions<T> extends CacheConfig {
    /** Time before background revalidation (default: 30s) */
    staleTime?: number;
    /** Initial data while loading */
    initialData?: T;
    /** Skip fetching (for conditional fetching) */
    skip?: boolean;
    /** Dependencies that trigger refetch */
    deps?: any[];
}

interface UseCachedDataReturn<T> {
    data: T | null;
    isLoading: boolean;
    isStale: boolean;
    error: Error | null;
    refetch: () => Promise<void>;
    invalidate: () => void;
}

/**
 * React hook for cached data fetching
 * Implements stale-while-revalidate pattern
 */
export function useCachedData<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: UseCachedDataOptions<T> = {}
): UseCachedDataReturn<T> {
    const {
        ttl = DEFAULT_TTL,
        storage = 'local',
        staleTime = 30 * 1000,
        initialData,
        skip = false,
        deps = []
    } = options;

    const [data, setData] = useState<T | null>(() => {
        // Try to get cached data on mount
        const cached = getCache<{ data: T; fetchTime: number }>(key, { storage, ttl });
        return cached?.data ?? initialData ?? null;
    });
    const [isLoading, setIsLoading] = useState(!data);
    const [isStale, setIsStale] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);
    const fetchingRef = useRef(false);

    const fetchData = useCallback(async (background = false) => {
        if (fetchingRef.current && background) return;
        
        fetchingRef.current = true;
        if (!background) setIsLoading(true);
        
        try {
            const result = await fetcher();
            
            if (mountedRef.current) {
                setData(result);
                setError(null);
                setIsStale(false);
                setCache(key, { data: result, fetchTime: Date.now() }, { storage, ttl });
            }
        } catch (e) {
            if (mountedRef.current) {
                setError(e instanceof Error ? e : new Error(String(e)));
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
            fetchingRef.current = false;
        }
    }, [key, fetcher, storage, ttl]);

    const invalidate = useCallback(() => {
        removeCache(key, { storage });
        setIsStale(true);
    }, [key, storage]);

    const refetch = useCallback(async () => {
        invalidate();
        await fetchData(false);
    }, [invalidate, fetchData]);

    useEffect(() => {
        mountedRef.current = true;
        
        if (skip) return;

        const cached = getCache<{ data: T; fetchTime: number }>(key, { storage, ttl });
        
        if (cached) {
            setData(cached.data);
            setIsLoading(false);
            
            // Check if stale
            const isDataStale = Date.now() - cached.fetchTime > staleTime;
            setIsStale(isDataStale);
            
            // Background revalidate if stale
            if (isDataStale) {
                fetchData(true);
            }
        } else {
            // No cache, fetch fresh
            fetchData(false);
        }

        return () => {
            mountedRef.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, skip, ...deps]);

    return { data, isLoading, isStale, error, refetch, invalidate };
}

// ============================================================
// PRELOADING UTILITIES
// ============================================================

/**
 * Prefetch data for a route (call on hover or focus)
 */
export function prefetchData<T>(
    key: string,
    fetcher: () => Promise<T>,
    config: CacheConfig = {}
): void {
    // Don't prefetch if already cached
    if (getCache(key, config)) return;
    
    // Prefetch in background
    fetcher().then(data => {
        setCache(key, { data, fetchTime: Date.now() }, config);
    }).catch(console.error);
}

/**
 * Clear cache on logout
 */
export function clearUserCache(): void {
    // Clear user-specific cache keys
    const userCachePatterns = ['tenants_', 'analytics_', 'settings_', 'requests_', 'users_'];
    
    if (typeof window !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key?.startsWith(CACHE_PREFIX)) {
                const cacheKey = key.replace(CACHE_PREFIX, '');
                if (userCachePatterns.some(pattern => cacheKey.startsWith(pattern))) {
                    localStorage.removeItem(key);
                }
            }
        }
    }
    
    // Clear memory cache
    memoryCache.forEach((_, key) => {
        const cacheKey = key.replace(CACHE_PREFIX, '');
        if (userCachePatterns.some(pattern => cacheKey.startsWith(pattern))) {
            memoryCache.delete(key);
        }
    });
}

// ============================================================
// PERFORMANCE MONITORING
// ============================================================

let cacheHits = 0;
let cacheMisses = 0;

export function getCacheStats(): { hits: number; misses: number; hitRate: string } {
    const total = cacheHits + cacheMisses;
    const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) + '%' : '0%';
    return { hits: cacheHits, misses: cacheMisses, hitRate };
}

export function resetCacheStats(): void {
    cacheHits = 0;
    cacheMisses = 0;
}

// Track cache performance (internal use)
export function trackCacheHit(): void { cacheHits++; }
export function trackCacheMiss(): void { cacheMisses++; }
