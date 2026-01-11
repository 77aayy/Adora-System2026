/**
 * Cache Strategy Utilities
 * Adora Hotel Management System V2
 */

// ============================================================
// INDEXEDDB CACHE
// ============================================================

const DB_NAME = 'adora_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

let db: IDBDatabase | null = null;

/**
 * Open IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };
    });
}

// ============================================================
// CACHE OPERATIONS
// ============================================================

interface CacheEntry<T> {
    key: string;
    value: T;
    timestamp: number;
    ttl: number; // Time to live in ms
}

/**
 * Set a value in cache
 */
export async function setCache<T>(
    key: string,
    value: T,
    ttlMinutes: number = 60
): Promise<void> {
    const database = await openDB();
    const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000,
    };

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a value from cache
 */
export async function getCache<T>(key: string): Promise<T | null> {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
            const entry = request.result as CacheEntry<T> | undefined;

            if (!entry) {
                resolve(null);
                return;
            }

            // Check if expired
            if (Date.now() - entry.timestamp > entry.ttl) {
                deleteCache(key);
                resolve(null);
                return;
            }

            resolve(entry.value);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a value from cache
 */
export async function deleteCache(key: string): Promise<void> {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
    const database = await openDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ============================================================
// STALE-WHILE-REVALIDATE
// ============================================================

/**
 * Get cached data while fetching fresh data in background
 */
export async function staleWhileRevalidate<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMinutes: number = 60
): Promise<T> {
    // Try to get cached value
    const cached = await getCache<T>(key);

    // Fetch fresh data in background
    const fetchAndCache = async () => {
        const fresh = await fetchFn();
        await setCache(key, fresh, ttlMinutes);
        return fresh;
    };

    if (cached !== null) {
        // Return cached value immediately, update in background
        fetchAndCache().catch(console.error);
        return cached;
    }

    // No cache, wait for fresh data
    return fetchAndCache();
}

// ============================================================
// MEMORY CACHE (Fast)
// ============================================================

const memoryCache = new Map<string, { value: any; expiry: number }>();

/**
 * Fast in-memory cache (lost on page reload)
 */
export function setMemoryCache<T>(key: string, value: T, ttlSeconds: number = 300): void {
    memoryCache.set(key, {
        value,
        expiry: Date.now() + ttlSeconds * 1000,
    });
}

export function getMemoryCache<T>(key: string): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
        memoryCache.delete(key);
        return null;
    }
    return entry.value as T;
}

export function clearMemoryCache(): void {
    memoryCache.clear();
}
