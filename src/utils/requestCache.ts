/**
 * Request Cache & Deduplication System
 * ⚡ PERFORMANCE: Prevents duplicate Firestore requests
 * 
 * Features:
 * 1. In-flight request deduplication (same request won't fire twice)
 * 2. Memory cache with TTL (short-lived cache for quick navigation)
 * 3. Stale-while-revalidate pattern
 */

// ============================================================
// TYPES
// ============================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

interface InFlightRequest<T> {
    promise: Promise<T>;
    timestamp: number;
}

// ============================================================
// CONFIGURATION
// ============================================================

const DEFAULT_TTL = 30 * 1000; // 30 seconds - short memory cache
const STALE_TTL = 5 * 60 * 1000; // 5 minutes - serve stale while revalidating
const IN_FLIGHT_TIMEOUT = 10 * 1000; // 10 seconds max for in-flight requests

// ============================================================
// CACHE STORAGE
// ============================================================

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, InFlightRequest<any>>();

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Get cached data if available and not expired
 */
export const getCached = <T>(key: string): T | null => {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    
    // Check if data is fresh
    if (now < entry.expiresAt) {
        console.log(`⚡ Cache HIT (fresh): ${key}`);
        return entry.data;
    }
    
    // Check if data is stale but usable
    if (now < entry.timestamp + STALE_TTL) {
        console.log(`⚡ Cache HIT (stale): ${key}`);
        return entry.data;
    }
    
    // Data is too old, remove it
    memoryCache.delete(key);
    return null;
};

/**
 * Set cache data with TTL
 */
export const setCache = <T>(key: string, data: T, ttl: number = DEFAULT_TTL): void => {
    const now = Date.now();
    memoryCache.set(key, {
        data,
        timestamp: now,
        expiresAt: now + ttl
    });
    console.log(`💾 Cache SET: ${key} (TTL: ${ttl / 1000}s)`);
};

/**
 * Check if there's an in-flight request for this key
 */
const getInFlightRequest = <T>(key: string): Promise<T> | null => {
    const inFlight = inFlightRequests.get(key);
    if (!inFlight) return null;
    
    // Check if request is still valid (not timed out)
    if (Date.now() - inFlight.timestamp > IN_FLIGHT_TIMEOUT) {
        inFlightRequests.delete(key);
        return null;
    }
    
    console.log(`🔄 Request DEDUPLICATED: ${key}`);
    return inFlight.promise;
};

/**
 * Register an in-flight request
 */
const setInFlightRequest = <T>(key: string, promise: Promise<T>): void => {
    inFlightRequests.set(key, {
        promise,
        timestamp: Date.now()
    });
    
    // Cleanup when done
    promise.finally(() => {
        inFlightRequests.delete(key);
    });
};

/**
 * Smart cached fetch with deduplication
 * @param key - Unique cache key
 * @param fetcher - Async function to fetch data
 * @param options - Cache options
 */
export const cachedFetch = async <T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
        ttl?: number;
        forceRefresh?: boolean;
        staleWhileRevalidate?: boolean;
    } = {}
): Promise<T> => {
    const { ttl = DEFAULT_TTL, forceRefresh = false, staleWhileRevalidate = true } = options;
    
    // 1. Check in-flight requests first (deduplication)
    if (!forceRefresh) {
        const inFlight = getInFlightRequest<T>(key);
        if (inFlight) return inFlight;
    }
    
    // 2. Check cache
    if (!forceRefresh) {
        const cached = getCached<T>(key);
        if (cached !== null) {
            // If stale-while-revalidate is enabled, refresh in background
            const entry = memoryCache.get(key);
            if (staleWhileRevalidate && entry && Date.now() > entry.expiresAt) {
                // Fire and forget background refresh
                cachedFetch(key, fetcher, { forceRefresh: true, ttl }).catch(() => {});
            }
            return cached;
        }
    }
    
    // 3. Fetch fresh data
    const promise = fetcher();
    setInFlightRequest(key, promise);
    
    try {
        const data = await promise;
        setCache(key, data, ttl);
        return data;
    } catch (error) {
        // On error, try to return stale data if available
        const entry = memoryCache.get(key);
        if (entry) {
            console.warn(`⚠️ Fetch failed, returning stale data for: ${key}`);
            return entry.data;
        }
        throw error;
    }
};

/**
 * Batch multiple requests into one (for related data)
 */
export const batchedFetch = async <T>(
    keys: string[],
    batchFetcher: (keys: string[]) => Promise<Map<string, T>>,
    ttl: number = DEFAULT_TTL
): Promise<Map<string, T>> => {
    const results = new Map<string, T>();
    const keysToFetch: string[] = [];
    
    // Check cache for each key
    for (const key of keys) {
        const cached = getCached<T>(key);
        if (cached !== null) {
            results.set(key, cached);
        } else {
            keysToFetch.push(key);
        }
    }
    
    // Fetch missing keys in batch
    if (keysToFetch.length > 0) {
        const fetched = await batchFetcher(keysToFetch);
        for (const [key, value] of fetched) {
            results.set(key, value);
            setCache(key, value, ttl);
        }
    }
    
    return results;
};

/**
 * Clear specific cache entry
 */
export const invalidateCache = (key: string): void => {
    memoryCache.delete(key);
    console.log(`🗑️ Cache INVALIDATED: ${key}`);
};

/**
 * Clear all cache entries matching a prefix
 */
export const invalidateCacheByPrefix = (prefix: string): void => {
    let count = 0;
    for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
            memoryCache.delete(key);
            count++;
        }
    }
    console.log(`🗑️ Cache INVALIDATED: ${count} entries with prefix "${prefix}"`);
};

/**
 * Clear entire cache
 */
export const clearAllCache = (): void => {
    memoryCache.clear();
    inFlightRequests.clear();
    console.log('🗑️ All cache CLEARED');
};

/**
 * Get cache stats (for debugging)
 */
export const getCacheStats = (): {
    entries: number;
    inFlight: number;
    keys: string[];
} => {
    return {
        entries: memoryCache.size,
        inFlight: inFlightRequests.size,
        keys: Array.from(memoryCache.keys())
    };
};

// ============================================================
// PRELOAD HELPERS
// ============================================================

/**
 * Preload data into cache (fire and forget)
 */
export const preloadData = <T>(key: string, fetcher: () => Promise<T>, ttl?: number): void => {
    const cached = getCached<T>(key);
    if (!cached) {
        cachedFetch(key, fetcher, { ttl }).catch(() => {});
    }
};

/**
 * Preload multiple keys in parallel
 */
export const preloadMultiple = (
    preloads: Array<{ key: string; fetcher: () => Promise<any>; ttl?: number }>
): void => {
    preloads.forEach(({ key, fetcher, ttl }) => preloadData(key, fetcher, ttl));
};
