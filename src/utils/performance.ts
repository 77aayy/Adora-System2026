/**
 * Performance Utilities
 * Advanced performance optimizations for Adora Hotel Management System V3
 */

// ============================================================
// DEBOUNCE & THROTTLE
// ============================================================

/**
 * Debounce function - delays execution until after wait time
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate?: boolean
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };

        const callNow = immediate && !timeout;

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func(...args);
    };
}

/**
 * Throttle function - limits execution to once per wait time
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// ============================================================
// PERFORMANCE MONITORING
// ============================================================

export interface PerformanceMetrics {
    renderTime: number;
    memoryUsage?: number;
    componentName: string;
}

/**
 * Measure component render time
 */
export function measureRenderTime(componentName: string): () => void {
    const start = performance.now();

    return () => {
        const end = performance.now();
        const renderTime = end - start;

        if (import.meta.env.DEV && renderTime > 16) {
            // Warn if render takes longer than one frame (16ms at 60fps)
            console.warn(`⚠️ Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
        }

        // Log to performance API
        if ('performance' in window && 'mark' in performance) {
            performance.mark(`${componentName}-render-end`);
            performance.measure(
                `${componentName}-render`,
                `${componentName}-render-start`,
                `${componentName}-render-end`
            );
        }
    };
}

/**
 * Get memory usage (if available)
 */
export function getMemoryUsage(): number | null {
    if ('memory' in performance) {
        const memory = (performance as any).memory;
        return memory.usedJSHeapSize / 1048576; // Convert to MB
    }
    return null;
}

// ============================================================
// BATCH UPDATES
// ============================================================

/**
 * Batch multiple state updates into a single render
 */
export function createBatchedUpdater<T>(
    updater: (items: T[]) => void,
    delay: number = 100
): (items: T[]) => void {
    let batch: T[] = [];
    let timeout: NodeJS.Timeout | null = null;

    return (items: T[]) => {
        batch.push(...items);

        if (timeout) clearTimeout(timeout);

        timeout = setTimeout(() => {
            updater(batch);
            batch = [];
        }, delay);
    };
}

// ============================================================
// LAZY LOADING HELPERS
// ============================================================

/**
 * Preload resources (images, fonts, etc.)
 */
export function preloadResource(url: string, as: 'image' | 'script' | 'style' | 'font' = 'image'): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
}

/**
 * Prefetch resource (lower priority preload)
 */
export function prefetchResource(url: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
}

// ============================================================
// IMAGE OPTIMIZATION
// ============================================================

/**
 * Lazy load images with Intersection Observer
 */
export function useLazyImage(src: string, placeholder?: string): {
    imageSrc: string;
    isLoaded: boolean;
    error: boolean;
} {
    const [imageSrc, setImageSrc] = React.useState(placeholder || '');
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [error, setError] = React.useState(false);

    React.useEffect(() => {
        const img = new Image();
        
        img.onload = () => {
            setImageSrc(src);
            setIsLoaded(true);
            setError(false);
        };
        
        img.onerror = () => {
            setError(true);
            setIsLoaded(false);
        };
        
        img.src = src;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [src]);

    return { imageSrc, isLoaded, error };
}

// ============================================================
// MEMOIZATION HELPERS
// ============================================================

/**
 * Deep compare function for useMemo dependencies
 */
export function deepEqual<T>(a: T, b: T): boolean {
    if (a === b) return true;
    
    if (a == null || b == null) return false;
    
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a) as Array<keyof T>;
    const keysB = Object.keys(b) as Array<keyof T>;

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}

// ============================================================
// RAF (Request Animation Frame) HELPERS
// ============================================================

/**
 * Execute function on next animation frame
 */
export function raf(callback: () => void): number {
    return requestAnimationFrame(callback);
}

/**
 * Cancel RAF
 */
export function cancelRaf(id: number): void {
    cancelAnimationFrame(id);
}

// ============================================================
// REACT IMPORT (for useLazyImage hook)
// ============================================================

import React from 'react';

// Export default for easier imports
export default {
    debounce,
    throttle,
    measureRenderTime,
    getMemoryUsage,
    createBatchedUpdater,
    preloadResource,
    prefetchResource,
    useLazyImage,
    deepEqual,
    raf,
    cancelRaf,
};
