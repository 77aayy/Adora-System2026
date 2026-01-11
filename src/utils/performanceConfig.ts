/**
 * Performance Configuration
 * Centralized settings for performance optimization
 * Adora Hotel Management System V3
 */

// ============================================================
// CACHE SETTINGS
// ============================================================

export const CACHE_CONFIG = {
    // Data cache duration (5 minutes)
    DATA_CACHE_DURATION: 5 * 60 * 1000,
    
    // Session cache (30 minutes)
    SESSION_CACHE_DURATION: 30 * 60 * 1000,
    
    // Heavy data cache (10 minutes)
    HEAVY_DATA_CACHE_DURATION: 10 * 60 * 1000,
    
    // API response cache (2 minutes)
    API_CACHE_DURATION: 2 * 60 * 1000,
};

// ============================================================
// FIREBASE QUERY LIMITS
// ============================================================

export const FIREBASE_LIMITS = {
    // Maximum documents per query
    MAX_DOCS_PER_QUERY: 100,
    
    // Batch size for writes
    BATCH_SIZE: 20,
    
    // Delay between batches (ms)
    BATCH_DELAY: 200,
    
    // Query timeout (ms)
    QUERY_TIMEOUT: 8000,
    
    // Maximum concurrent queries
    MAX_CONCURRENT_QUERIES: 5,
};

// ============================================================
// UI PERFORMANCE
// ============================================================

export const UI_CONFIG = {
    // Debounce delay for search inputs (ms)
    SEARCH_DEBOUNCE: 300,
    
    // Throttle delay for scroll events (ms)
    SCROLL_THROTTLE: 100,
    
    // Animation duration (ms)
    ANIMATION_DURATION: 200,
    
    // Virtual list item height (px)
    VIRTUAL_LIST_ITEM_HEIGHT: 60,
    
    // Virtual list overscan
    VIRTUAL_LIST_OVERSCAN: 5,
    
    // Maximum items before virtualization
    VIRTUALIZATION_THRESHOLD: 50,
    
    // Lazy load image threshold
    LAZY_LOAD_THRESHOLD: '200px',
};

// ============================================================
// REACT OPTIMIZATION
// ============================================================

export const REACT_CONFIG = {
    // Re-render threshold for memo (ms)
    MEMO_THRESHOLD: 16, // ~60fps
    
    // State update batch window (ms)
    STATE_BATCH_WINDOW: 50,
    
    // Suspense timeout (ms)
    SUSPENSE_TIMEOUT: 3000,
};

// ============================================================
// MEMORY MANAGEMENT
// ============================================================

export const MEMORY_CONFIG = {
    // Maximum cached items
    MAX_CACHE_ITEMS: 100,
    
    // Cache cleanup interval (ms)
    CACHE_CLEANUP_INTERVAL: 60 * 1000,
    
    // Image cache limit (MB)
    IMAGE_CACHE_LIMIT: 50,
};

// ============================================================
// NETWORK OPTIMIZATION
// ============================================================

export const NETWORK_CONFIG = {
    // Request timeout (ms)
    REQUEST_TIMEOUT: 10000,
    
    // Retry attempts
    MAX_RETRIES: 3,
    
    // Retry delay base (ms)
    RETRY_DELAY_BASE: 1000,
    
    // Retry delay multiplier
    RETRY_DELAY_MULTIPLIER: 2,
    
    // Concurrent uploads limit
    MAX_CONCURRENT_UPLOADS: 2,
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Simple in-memory cache with expiration
 */
class SimpleCache<T> {
    private cache = new Map<string, { data: T; expiry: number }>();
    
    get(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }
    
    set(key: string, data: T, ttl: number = CACHE_CONFIG.DATA_CACHE_DURATION): void {
        // Cleanup if cache is too large
        if (this.cache.size >= MEMORY_CONFIG.MAX_CACHE_ITEMS) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, { data, expiry: Date.now() + ttl });
    }
    
    delete(key: string): void {
        this.cache.delete(key);
    }
    
    clear(): void {
        this.cache.clear();
    }
    
    size(): number {
        return this.cache.size;
    }
}

// Export singleton cache instances
export const dataCache = new SimpleCache<any>();
export const queryCache = new SimpleCache<any>();
export const imageCache = new SimpleCache<string>();

/**
 * Batch async operations with delay
 */
export const batchAsync = async <T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    batchSize: number = FIREBASE_LIMITS.BATCH_SIZE,
    delay: number = FIREBASE_LIMITS.BATCH_DELAY
): Promise<any[]> => {
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(processor));
        results.push(...batchResults);
        
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    return results;
};

/**
 * Create timeout promise
 */
export const createTimeout = (ms: number): Promise<never> => {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), ms);
    });
};

/**
 * Race with timeout
 */
export const withTimeout = <T>(
    promise: Promise<T>,
    ms: number = FIREBASE_LIMITS.QUERY_TIMEOUT
): Promise<T> => {
    return Promise.race([promise, createTimeout(ms)]);
};

/**
 * Retry with exponential backoff
 */
export const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = NETWORK_CONFIG.MAX_RETRIES,
    baseDelay: number = NETWORK_CONFIG.RETRY_DELAY_BASE
): Promise<T> => {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            
            // Don't retry on quota errors
            if (error?.code === 'resource-exhausted') {
                throw error;
            }
            
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(NETWORK_CONFIG.RETRY_DELAY_MULTIPLIER, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
};
