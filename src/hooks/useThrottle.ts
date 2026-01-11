/**
 * Throttle Hook
 * React hook for throttling values
 * Adora Hotel Management System V3
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Throttle a value
 */
export function useThrottle<T>(value: T, limit: number = 300): T {
    const [throttledValue, setThrottledValue] = useState<T>(value);
    const lastRan = useRef<number>(Date.now());

    useEffect(() => {
        const handler = setTimeout(() => {
            if (Date.now() - lastRan.current >= limit) {
                setThrottledValue(value);
                lastRan.current = Date.now();
            }
        }, limit - (Date.now() - lastRan.current));

        return () => {
            clearTimeout(handler);
        };
    }, [value, limit]);

    return throttledValue;
}
