/**
 * Production Optimizations
 * Utilities to ensure optimal performance in production
 * 
 * Adora Hotel Management System V3
 */

// ============================================================
// MEMORY & PERFORMANCE MONITORING
// ============================================================

/**
 * Check if browser supports performance monitoring
 */
const hasPerformanceAPI = typeof performance !== 'undefined' && 'memory' in performance;

/**
 * Get current memory usage (Chrome only)
 */
export const getMemoryUsage = (): { used: number; total: number; percent: number } | null => {
    if (!hasPerformanceAPI) return null;
    
    const memory = (performance as any).memory;
    if (!memory) return null;
    
    const used = memory.usedJSHeapSize;
    const total = memory.jsHeapSizeLimit;
    const percent = Math.round((used / total) * 100);
    
    return {
        used: Math.round(used / 1024 / 1024), // MB
        total: Math.round(total / 1024 / 1024), // MB
        percent
    };
};

/**
 * Log performance metrics
 */
export const logPerformanceMetrics = (): void => {
    if (process.env.NODE_ENV !== 'production') return;
    
    const memory = getMemoryUsage();
    if (memory) {
        console.log(`📊 Memory: ${memory.used}MB / ${memory.total}MB (${memory.percent}%)`);
    }
    
    // Log paint metrics
    const paintEntries = performance.getEntriesByType('paint');
    paintEntries.forEach(entry => {
        console.log(`🎨 ${entry.name}: ${Math.round(entry.startTime)}ms`);
    });
};

// ============================================================
// LAZY LOADING HELPERS
// ============================================================

/**
 * Lazy load an image with IntersectionObserver
 */
export const lazyLoadImage = (
    imgElement: HTMLImageElement,
    src: string,
    options: { threshold?: number; rootMargin?: string } = {}
): () => void => {
    const { threshold = 0.1, rootMargin = '50px' } = options;
    
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    imgElement.src = src;
                    imgElement.onload = () => imgElement.classList.add('loaded');
                    observer.unobserve(imgElement);
                }
            });
        },
        { threshold, rootMargin }
    );
    
    observer.observe(imgElement);
    
    // Return cleanup function
    return () => observer.disconnect();
};

// ============================================================
// BUNDLE SIZE HELPERS
// ============================================================

/**
 * Get loaded script sizes (for debugging)
 */
export const getScriptSizes = (): { name: string; size: string }[] => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    return resources
        .filter(r => r.initiatorType === 'script')
        .map(r => ({
            name: r.name.split('/').pop() || r.name,
            size: r.transferSize ? `${Math.round(r.transferSize / 1024)}KB` : 'cached'
        }))
        .sort((a, b) => {
            const sizeA = parseInt(a.size) || 0;
            const sizeB = parseInt(b.size) || 0;
            return sizeB - sizeA;
        });
};

// ============================================================
// CACHING STRATEGIES
// ============================================================

/**
 * Cache API response in sessionStorage
 */
export const cacheResponse = <T>(
    key: string,
    data: T,
    ttlMinutes: number = 5
): void => {
    const cacheEntry = {
        data,
        expiry: Date.now() + (ttlMinutes * 60 * 1000)
    };
    
    try {
        sessionStorage.setItem(`cache_${key}`, JSON.stringify(cacheEntry));
    } catch (e) {
        // Storage quota exceeded, clear old items
        clearExpiredCache();
    }
};

/**
 * Get cached response
 */
export const getCachedResponse = <T>(key: string): T | null => {
    try {
        const cached = sessionStorage.getItem(`cache_${key}`);
        if (!cached) return null;
        
        const { data, expiry } = JSON.parse(cached);
        if (Date.now() > expiry) {
            sessionStorage.removeItem(`cache_${key}`);
            return null;
        }
        
        return data as T;
    } catch {
        return null;
    }
};

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = (): void => {
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith('cache_')) {
            try {
                const cached = sessionStorage.getItem(key);
                if (cached) {
                    const { expiry } = JSON.parse(cached);
                    if (Date.now() > expiry) {
                        keysToRemove.push(key);
                    }
                }
            } catch {
                keysToRemove.push(key!);
            }
        }
    }
    
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
};

// ============================================================
// NETWORK OPTIMIZATION
// ============================================================

/**
 * Preload critical resources
 */
export const preloadResources = (urls: string[]): void => {
    urls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        
        if (url.endsWith('.js')) link.as = 'script';
        else if (url.endsWith('.css')) link.as = 'style';
        else if (url.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) link.as = 'image';
        else if (url.endsWith('.woff2')) link.as = 'font';
        
        document.head.appendChild(link);
    });
};

/**
 * Prefetch resources for future navigation
 */
export const prefetchResources = (urls: string[]): void => {
    urls.forEach(url => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    });
};

// ============================================================
// RENDER OPTIMIZATION
// ============================================================

/**
 * Debounce expensive operations
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

/**
 * Throttle frequent operations
 */
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let inThrottle = false;
    
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// ============================================================
// BATTERY OPTIMIZATION (Mobile)
// ============================================================

/**
 * Check battery status and optimize accordingly
 */
export const getBatteryOptimizations = async (): Promise<{
    shouldReduceAnimations: boolean;
    shouldReducePolling: boolean;
}> => {
    const defaults = {
        shouldReduceAnimations: false,
        shouldReducePolling: false
    };
    
    if (!('getBattery' in navigator)) return defaults;
    
    try {
        const battery = await (navigator as any).getBattery();
        const lowBattery = battery.level < 0.2 && !battery.charging;
        
        return {
            shouldReduceAnimations: lowBattery,
            shouldReducePolling: lowBattery
        };
    } catch {
        return defaults;
    }
};

// ============================================================
// CONSOLE CLEANUP (Production)
// ============================================================

/**
 * Disable console in production (optional)
 */
export const disableConsoleInProduction = (): void => {
    if (process.env.NODE_ENV !== 'production') return;
    
    const noop = () => {};
    
    // Keep error and warn for debugging
    ['log', 'debug', 'info', 'trace', 'dir', 'table', 'time', 'timeEnd'].forEach(method => {
        (console as any)[method] = noop;
    });
};

/**
 * Production-safe console log
 */
export const prodLog = (...args: any[]): void => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(...args);
    }
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize production optimizations
 */
export const initProductionOptimizations = (): void => {
    // Clear expired cache on load
    clearExpiredCache();
    
    // Log performance metrics (in dev mode)
    if (process.env.NODE_ENV !== 'production') {
        window.addEventListener('load', () => {
            setTimeout(logPerformanceMetrics, 1000);
        });
    }
    
    // Preload critical fonts
    preloadResources([
        '/fonts/inter-var.woff2',
        '/fonts/tajawal-var.woff2'
    ]);
};

export default {
    getMemoryUsage,
    logPerformanceMetrics,
    lazyLoadImage,
    getScriptSizes,
    cacheResponse,
    getCachedResponse,
    clearExpiredCache,
    preloadResources,
    prefetchResources,
    debounce,
    throttle,
    getBatteryOptimizations,
    disableConsoleInProduction,
    prodLog,
    initProductionOptimizations
};
