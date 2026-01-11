/**
 * Data Caching Service
 * Reduces Firebase reads by caching frequently accessed data
 * Adora Hotel Management System - SaaS
 * 
 * ✅ SAFE: This is an addition, doesn't modify existing code
 * ✅ BENEFIT: Reduces Firebase costs & improves load times
 */

// ============================================================
// TYPES
// ============================================================

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
    defaultTTL: number;
    maxEntries: number;
}

// ============================================================
// CACHE STORAGE
// ============================================================

const cache = new Map<string, CacheEntry<any>>();

const DEFAULT_CONFIG: CacheConfig = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes default
    maxEntries: 100,
};

// ============================================================
// TTL CONFIGURATIONS (per data type)
// ============================================================

export const CACHE_TTL = {
    // Static data (rarely changes)
    ROOMS: 10 * 60 * 1000,        // 10 minutes - rooms don't change often
    EMPLOYEES: 5 * 60 * 1000,     // 5 minutes - employees rarely change
    SETTINGS: 15 * 60 * 1000,     // 15 minutes - settings are static
    BRANCHES: 30 * 60 * 1000,     // 30 minutes - branches almost never change
    
    // Dynamic data (changes frequently)
    REQUESTS: 30 * 1000,          // 30 seconds - requests change often
    ROOM_STATUS: 60 * 1000,       // 1 minute - room status updates
    STATS: 2 * 60 * 1000,         // 2 minutes - statistics
    
    // Real-time data (very short cache)
    NOTIFICATIONS: 10 * 1000,     // 10 seconds
    ACTIVE_USERS: 15 * 1000,      // 15 seconds
} as const;

// ============================================================
// CACHE OPERATIONS
// ============================================================

/**
 * Get data from cache
 * Returns null if not found or expired
 */
export function getFromCache<T>(key: string): T | null {
    const entry = cache.get(key);
    
    if (!entry) {
        return null;
    }
    
    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
        cache.delete(key);
        return null;
    }
    
    return entry.data as T;
}

/**
 * Set data in cache
 */
export function setInCache<T>(key: string, data: T, ttl: number = DEFAULT_CONFIG.defaultTTL): void {
    // Enforce max entries
    if (cache.size >= DEFAULT_CONFIG.maxEntries) {
        // Remove oldest entry
        const oldestKey = cache.keys().next().value;
        if (oldestKey) {
            cache.delete(oldestKey);
        }
    }
    
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
    });
}

/**
 * Remove specific entry from cache
 */
export function invalidateCache(key: string): void {
    cache.delete(key);
}

/**
 * Remove all entries matching a pattern
 * @example invalidateCachePattern('rooms_') - removes all room caches
 */
export function invalidateCachePattern(pattern: string): void {
    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[] } {
    return {
        size: cache.size,
        keys: Array.from(cache.keys()),
    };
}

// ============================================================
// CACHE KEY GENERATORS
// ============================================================

export const cacheKeys = {
    rooms: (tenantId: string, branchId: string) => `rooms_${tenantId}_${branchId}`,
    employees: (tenantId: string, branchId: string) => `employees_${tenantId}_${branchId}`,
    settings: (tenantId: string) => `settings_${tenantId}`,
    branches: (tenantId: string) => `branches_${tenantId}`,
    requests: (tenantId: string, branchId: string, dept: string) => `requests_${tenantId}_${branchId}_${dept}`,
    stats: (tenantId: string, branchId: string) => `stats_${tenantId}_${branchId}`,
    roomStatus: (tenantId: string, branchId: string, roomNumber: string) => `room_status_${tenantId}_${branchId}_${roomNumber}`,
};

// ============================================================
// CACHED DATA FETCHERS
// ============================================================

/**
 * Get data with cache support
 * Fetches from cache first, then from source if not found
 * 
 * @example
 * ```typescript
 * const rooms = await getCachedData(
 *   cacheKeys.rooms(tenantId, branchId),
 *   () => fetchRoomsFromFirestore(tenantId, branchId),
 *   CACHE_TTL.ROOMS
 * );
 * ```
 */
export async function getCachedData<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = DEFAULT_CONFIG.defaultTTL
): Promise<T> {
    // Try cache first
    const cached = getFromCache<T>(key);
    if (cached !== null) {
        console.log(`📦 Cache HIT: ${key}`);
        return cached;
    }
    
    // Fetch from source
    console.log(`🔄 Cache MISS: ${key} - fetching...`);
    const data = await fetcher();
    
    // Store in cache
    setInCache(key, data, ttl);
    
    return data;
}

/**
 * Prefetch data into cache
 * Useful for loading data in background before user needs it
 * 
 * @example
 * ```typescript
 * // When user logs in, prefetch common data
 * prefetchData([
 *   { key: cacheKeys.rooms(tenantId, branchId), fetcher: fetchRooms, ttl: CACHE_TTL.ROOMS },
 *   { key: cacheKeys.employees(tenantId, branchId), fetcher: fetchEmployees, ttl: CACHE_TTL.EMPLOYEES },
 * ]);
 * ```
 */
export async function prefetchData(
    items: Array<{ key: string; fetcher: () => Promise<any>; ttl: number }>
): Promise<void> {
    console.log('🚀 Prefetching data...');
    
    await Promise.all(
        items.map(async ({ key, fetcher, ttl }) => {
            try {
                const data = await fetcher();
                setInCache(key, data, ttl);
                console.log(`✅ Prefetched: ${key}`);
            } catch (error) {
                console.warn(`⚠️ Failed to prefetch: ${key}`, error);
            }
        })
    );
    
    console.log('✅ Prefetch complete');
}

// ============================================================
// CACHE HOOKS (React Integration)
// ============================================================

/**
 * Hook for using cached data in React components
 * 
 * @example
 * ```typescript
 * const { data: rooms, loading, refresh } = useCachedData(
 *   cacheKeys.rooms(tenantId, branchId),
 *   () => fetchRooms(tenantId, branchId),
 *   CACHE_TTL.ROOMS
 * );
 * ```
 */
export function createCacheHook<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number
): {
    getData: () => Promise<T>;
    invalidate: () => void;
    isCached: () => boolean;
} {
    return {
        getData: () => getCachedData(key, fetcher, ttl),
        invalidate: () => invalidateCache(key),
        isCached: () => getFromCache(key) !== null,
    };
}

// ============================================================
// AUTO INVALIDATION
// ============================================================

/**
 * Invalidate related caches when data changes
 * Call this after mutations (create/update/delete)
 * 
 * @example
 * ```typescript
 * // After adding a new room
 * await addRoom(roomData);
 * invalidateRelatedCaches('rooms', tenantId, branchId);
 * ```
 */
export function invalidateRelatedCaches(
    dataType: 'rooms' | 'employees' | 'requests' | 'settings',
    tenantId: string,
    branchId?: string
): void {
    switch (dataType) {
        case 'rooms':
            if (branchId) {
                invalidateCache(cacheKeys.rooms(tenantId, branchId));
                invalidateCachePattern(`room_status_${tenantId}_${branchId}`);
            } else {
                invalidateCachePattern(`rooms_${tenantId}`);
            }
            break;
            
        case 'employees':
            if (branchId) {
                invalidateCache(cacheKeys.employees(tenantId, branchId));
            } else {
                invalidateCachePattern(`employees_${tenantId}`);
            }
            break;
            
        case 'requests':
            if (branchId) {
                invalidateCachePattern(`requests_${tenantId}_${branchId}`);
                invalidateCache(cacheKeys.stats(tenantId, branchId));
            } else {
                invalidateCachePattern(`requests_${tenantId}`);
                invalidateCachePattern(`stats_${tenantId}`);
            }
            break;
            
        case 'settings':
            invalidateCache(cacheKeys.settings(tenantId));
            break;
    }
    
    console.log(`🗑️ Invalidated ${dataType} cache for tenant ${tenantId}`);
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    get: getFromCache,
    set: setInCache,
    invalidate: invalidateCache,
    invalidatePattern: invalidateCachePattern,
    clear: clearCache,
    stats: getCacheStats,
    getCachedData,
    prefetchData,
    keys: cacheKeys,
    TTL: CACHE_TTL,
};
