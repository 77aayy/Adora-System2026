/**
 * Performance Hook
 * React hook for monitoring component performance
 * Adora Hotel Management System V3
 */

import { useEffect, useRef, useCallback } from 'react';
import { measureRenderTime, getMemoryUsage, type PerformanceMetrics } from '../utils/performance';

interface UsePerformanceOptions {
    componentName: string;
    logMetrics?: boolean;
    warnThreshold?: number; // Warn if render time exceeds this (ms)
}

export function usePerformance(options: UsePerformanceOptions) {
    const { componentName, logMetrics = false, warnThreshold = 16 } = options;
    const renderCountRef = useRef(0);
    const renderTimesRef = useRef<number[]>([]);

    useEffect(() => {
        const startTime = performance.now();
        const startMark = `${componentName}-render-start-${renderCountRef.current}`;
        const endMark = `${componentName}-render-end-${renderCountRef.current}`;

        if ('performance' in window && 'mark' in performance) {
            performance.mark(startMark);
        }

        renderCountRef.current += 1;

        return () => {
            const endTime = performance.now();
            const renderTime = endTime - startTime;

            renderTimesRef.current.push(renderTime);

            // Keep only last 10 renders
            if (renderTimesRef.current.length > 10) {
                renderTimesRef.current.shift();
            }

            if ('performance' in window && 'mark' in performance && 'measure' in performance) {
                performance.mark(endMark);
                performance.measure(
                    `${componentName}-render-${renderCountRef.current - 1}`,
                    startMark,
                    endMark
                );
            }

            // Warn if render is slow
            if (renderTime > warnThreshold && import.meta.env.DEV) {
                console.warn(
                    `⚠️ Slow render: ${componentName} took ${renderTime.toFixed(2)}ms (threshold: ${warnThreshold}ms)`
                );
            }

            // Log metrics if enabled
            if (logMetrics && import.meta.env.DEV) {
                const avgRenderTime =
                    renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
                const memoryUsage = getMemoryUsage();

                console.log(`📊 ${componentName} Performance:`, {
                    renderTime: `${renderTime.toFixed(2)}ms`,
                    avgRenderTime: `${avgRenderTime.toFixed(2)}ms`,
                    renderCount: renderCountRef.current,
                    memoryUsage: memoryUsage ? `${memoryUsage.toFixed(2)}MB` : 'N/A',
                });
            }
        };
    });

    const getMetrics = useCallback((): PerformanceMetrics => {
        const avgRenderTime =
            renderTimesRef.current.length > 0
                ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
                : 0;

        return {
            renderTime: avgRenderTime,
            memoryUsage: getMemoryUsage() || undefined,
            componentName,
        };
    }, [componentName]);

    return {
        renderCount: renderCountRef.current,
        getMetrics,
    };
}
