/**
 * Performance Monitor Service
 * App performance tracking
 * Adora Hotel Management System V2
 */

import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

interface PerformanceMetrics {
    pageLoadTime: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    timeToInteractive: number;
    memoryUsage?: number;
    fps: number;
}

interface ResourceTiming {
    name: string;
    duration: number;
    size: number;
    type: string;
}

// ============================================================
// STATE
// ============================================================

let fpsHistory: number[] = [];
let fpsInterval: number | null = null;
let lastFrameTime = performance.now();
let frameCount = 0;

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize performance monitoring
 */
export const initPerformanceMonitor = (): void => {
    // Start FPS monitoring
    startFPSMonitor();

    // Log initial metrics
    logInitialMetrics();

    logger.info('✅ Performance monitor initialized', undefined, 'performanceService');
};

/**
 * Cleanup
 */
export const destroyPerformanceMonitor = (): void => {
    if (fpsInterval) {
        cancelAnimationFrame(fpsInterval);
        fpsInterval = null;
    }
};

// ============================================================
// FPS MONITORING
// ============================================================

/**
 * Start FPS monitor
 */
const startFPSMonitor = (): void => {
    const measureFPS = () => {
        frameCount++;
        const now = performance.now();
        const delta = now - lastFrameTime;

        if (delta >= 1000) {
            const fps = Math.round((frameCount * 1000) / delta);
            fpsHistory.push(fps);

            // Keep last 60 readings
            if (fpsHistory.length > 60) {
                fpsHistory.shift();
            }

            frameCount = 0;
            lastFrameTime = now;
        }

        fpsInterval = requestAnimationFrame(measureFPS);
    };

    fpsInterval = requestAnimationFrame(measureFPS);
};

/**
 * Get current FPS
 */
export const getCurrentFPS = (): number => {
    return fpsHistory.length > 0 ? fpsHistory[fpsHistory.length - 1] : 60;
};

/**
 * Get average FPS
 */
export const getAverageFPS = (): number => {
    if (fpsHistory.length === 0) return 60;
    return Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
};

// ============================================================
// CORE METRICS
// ============================================================

/**
 * Get performance metrics
 */
export const getPerformanceMetrics = (): PerformanceMetrics => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const lcp = performance.getEntriesByType('largest-contentful-paint');

    const fcpEntry = paint.find(p => p.name === 'first-contentful-paint');
    const lcpEntry = lcp.length > 0 ? lcp[lcp.length - 1] : null;

    return {
        pageLoadTime: navigation?.loadEventEnd - navigation?.startTime || 0,
        firstContentfulPaint: fcpEntry?.startTime || 0,
        largestContentfulPaint: (lcpEntry as any)?.startTime || 0,
        timeToInteractive: navigation?.domInteractive - navigation?.startTime || 0,
        memoryUsage: getMemoryUsage(),
        fps: getCurrentFPS()
    };
};

/**
 * Get memory usage (if available)
 */
const getMemoryUsage = (): number | undefined => {
    if ('memory' in performance) {
        const memory = (performance as any).memory;
        return Math.round(memory.usedJSHeapSize / (1024 * 1024));
    }
    return undefined;
};

/**
 * Log initial metrics
 */
const logInitialMetrics = (): void => {
    // Wait for page to fully load
    window.addEventListener('load', () => {
        setTimeout(() => {
            const metrics = getPerformanceMetrics();
            logger.info('📊 Performance Metrics:', metrics, 'performanceService');

            // Warn if slow
            if (metrics.pageLoadTime > 3000) {
                logger.warn(`⚠️ Slow page load: ${metrics.pageLoadTime}ms`, undefined, 'performanceService');
            }

            if (metrics.firstContentfulPaint > 2000) {
                logger.warn(`⚠️ Slow FCP: ${metrics.firstContentfulPaint}ms`, undefined, 'performanceService');
            }
        }, 100);
    });
};

// ============================================================
// RESOURCE TIMING
// ============================================================

/**
 * Get slow resources
 */
export const getSlowResources = (threshold = 500): ResourceTiming[] => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    return resources
        .filter(r => r.duration > threshold)
        .map(r => ({
            name: r.name.split('/').pop() || r.name,
            duration: Math.round(r.duration),
            size: r.transferSize || 0,
            type: r.initiatorType
        }))
        .sort((a, b) => b.duration - a.duration);
};

/**
 * Get resource summary
 */
export const getResourceSummary = (): { total: number; byType: Record<string, number> } => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    const byType: Record<string, number> = {};
    let total = 0;

    resources.forEach(r => {
        const size = r.transferSize || 0;
        total += size;
        byType[r.initiatorType] = (byType[r.initiatorType] || 0) + size;
    });

    return { total, byType };
};

// ============================================================
// TIMING HELPERS
// ============================================================

const marks: Map<string, number> = new Map();

/**
 * Start timing
 */
export const startTiming = (label: string): void => {
    marks.set(label, performance.now());
};

/**
 * End timing and return duration
 */
export const endTiming = (label: string): number => {
    const start = marks.get(label);
    if (!start) return 0;

    const duration = performance.now() - start;
    marks.delete(label);

    return Math.round(duration);
};

/**
 * Measure async function duration
 */
export const measureAsync = async <T>(
    label: string,
    fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const duration = Math.round(performance.now() - start);

    logger.info(`⏱️ ${label}: ${duration}ms`, undefined, 'performanceService');

    return { result, duration };
};

// ============================================================
// PERFORMANCE SCORE
// ============================================================

/**
 * Calculate performance score (0-100)
 */
export const getPerformanceScore = (): number => {
    const metrics = getPerformanceMetrics();

    let score = 100;

    // Penalize slow page load (target: < 2s)
    if (metrics.pageLoadTime > 2000) {
        score -= Math.min(30, (metrics.pageLoadTime - 2000) / 100);
    }

    // Penalize slow FCP (target: < 1.5s)
    if (metrics.firstContentfulPaint > 1500) {
        score -= Math.min(20, (metrics.firstContentfulPaint - 1500) / 100);
    }

    // Penalize low FPS (target: 60)
    if (metrics.fps < 60) {
        score -= Math.min(20, (60 - metrics.fps));
    }

    // Penalize high memory (target: < 100MB)
    if (metrics.memoryUsage && metrics.memoryUsage > 100) {
        score -= Math.min(15, (metrics.memoryUsage - 100) / 10);
    }

    return Math.max(0, Math.round(score));
};

/**
 * Get performance rating
 */
export const getPerformanceRating = (): 'excellent' | 'good' | 'fair' | 'poor' => {
    const score = getPerformanceScore();

    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
};

// ============================================================
// DEBUG OVERLAY
// ============================================================

let debugOverlay: HTMLElement | null = null;
let debugInterval: number | null = null;

/**
 * Show debug overlay
 */
export const showDebugOverlay = (): void => {
    if (debugOverlay) return;

    debugOverlay = document.createElement('div');
    debugOverlay.id = 'perf-debug';
    debugOverlay.className = 'fixed top-2 left-2 z-[9999] bg-black/90 text-white text-xs p-3 rounded-lg font-mono';
    document.body.appendChild(debugOverlay);

    const updateOverlay = () => {
        const metrics = getPerformanceMetrics();
        const rating = getPerformanceRating();

        debugOverlay!.innerHTML = `
            <div class="mb-1"><strong>⚡ Performance</strong></div>
            <div>FPS: ${metrics.fps} ${metrics.fps >= 55 ? '✅' : '⚠️'}</div>
            <div>Memory: ${metrics.memoryUsage || '?'} MB</div>
            <div>Score: ${getPerformanceScore()}/100</div>
            <div>Rating: ${rating}</div>
        `;
    };

    updateOverlay();
    debugInterval = window.setInterval(updateOverlay, 1000);
};

/**
 * Hide debug overlay
 */
export const hideDebugOverlay = (): void => {
    debugOverlay?.remove();
    debugOverlay = null;

    if (debugInterval) {
        clearInterval(debugInterval);
        debugInterval = null;
    }
};

/**
 * Toggle debug overlay
 */
export const toggleDebugOverlay = (): boolean => {
    if (debugOverlay) {
        hideDebugOverlay();
        return false;
    } else {
        showDebugOverlay();
        return true;
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect } from 'react';

export const usePerformance = (showDebug = false) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [score, setScore] = useState(100);

    useEffect(() => {
        initPerformanceMonitor();

        const interval = setInterval(() => {
            setMetrics(getPerformanceMetrics());
            setScore(getPerformanceScore());
        }, 2000);

        if (showDebug) {
            showDebugOverlay();
        }

        return () => {
            clearInterval(interval);
            destroyPerformanceMonitor();
            if (showDebug) hideDebugOverlay();
        };
    }, [showDebug]);

    return {
        metrics,
        score,
        rating: getPerformanceRating(),
        fps: getCurrentFPS(),
        avgFPS: getAverageFPS(),
        slowResources: getSlowResources
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    initPerformanceMonitor,
    destroyPerformanceMonitor,
    getCurrentFPS,
    getAverageFPS,
    getPerformanceMetrics,
    getSlowResources,
    getResourceSummary,
    startTiming,
    endTiming,
    measureAsync,
    getPerformanceScore,
    getPerformanceRating,
    showDebugOverlay,
    hideDebugOverlay,
    toggleDebugOverlay,
    usePerformance
};
