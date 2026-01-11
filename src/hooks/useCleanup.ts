/**
 * Cleanup Hooks
 * Ensures all subscriptions, timers, and listeners are properly cleaned up
 * 
 * ⚠️ CRITICAL: Prevents memory leaks and battery drain
 * 
 * Adora Hotel Management System V3
 */

import { useEffect, useRef, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

type CleanupFunction = () => void;
type UnsubscribeFunction = () => void;

// ============================================================
// SUBSCRIPTION MANAGER
// ============================================================

/**
 * Hook to manage multiple Firestore subscriptions
 * Automatically cleans up all subscriptions on unmount
 */
export function useFirestoreSubscriptions() {
    const subscriptions = useRef<UnsubscribeFunction[]>([]);
    const isMounted = useRef(true);

    // Add a subscription
    const addSubscription = useCallback((unsubscribe: UnsubscribeFunction) => {
        if (isMounted.current) {
            subscriptions.current.push(unsubscribe);
        } else {
            // Already unmounted, clean up immediately
            unsubscribe();
        }
    }, []);

    // Remove a specific subscription
    const removeSubscription = useCallback((unsubscribe: UnsubscribeFunction) => {
        const index = subscriptions.current.indexOf(unsubscribe);
        if (index > -1) {
            subscriptions.current.splice(index, 1);
            unsubscribe();
        }
    }, []);

    // Clear all subscriptions
    const clearAllSubscriptions = useCallback(() => {
        const count = subscriptions.current.length;
        subscriptions.current.forEach(unsub => {
            try {
                unsub();
            } catch (e) {
                console.warn('Subscription cleanup error:', e);
            }
        });
        subscriptions.current = [];
        if (count > 0) {
            console.log(`🧹 Cleaned up ${count} Firestore subscriptions`);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        
        return () => {
            isMounted.current = false;
            clearAllSubscriptions();
        };
    }, [clearAllSubscriptions]);

    return {
        addSubscription,
        removeSubscription,
        clearAllSubscriptions,
        subscriptionCount: () => subscriptions.current.length,
        isMounted: () => isMounted.current
    };
}

// ============================================================
// INTERVAL/TIMEOUT MANAGER
// ============================================================

/**
 * Hook to manage multiple intervals and timeouts
 * Automatically clears all on unmount
 */
export function useTimerCleanup() {
    const intervals = useRef<NodeJS.Timeout[]>([]);
    const timeouts = useRef<NodeJS.Timeout[]>([]);
    const isMounted = useRef(true);

    // Safe setInterval
    const safeSetInterval = useCallback((callback: () => void, ms: number) => {
        if (!isMounted.current) return null;
        
        const id = setInterval(() => {
            if (isMounted.current) {
                callback();
            }
        }, ms);
        intervals.current.push(id);
        return id;
    }, []);

    // Safe setTimeout
    const safeSetTimeout = useCallback((callback: () => void, ms: number) => {
        if (!isMounted.current) return null;
        
        const id = setTimeout(() => {
            if (isMounted.current) {
                callback();
            }
            // Remove from tracked timeouts
            const index = timeouts.current.indexOf(id);
            if (index > -1) timeouts.current.splice(index, 1);
        }, ms);
        timeouts.current.push(id);
        return id;
    }, []);

    // Clear specific interval
    const clearSafeInterval = useCallback((id: NodeJS.Timeout | null) => {
        if (!id) return;
        clearInterval(id);
        const index = intervals.current.indexOf(id);
        if (index > -1) intervals.current.splice(index, 1);
    }, []);

    // Clear specific timeout
    const clearSafeTimeout = useCallback((id: NodeJS.Timeout | null) => {
        if (!id) return;
        clearTimeout(id);
        const index = timeouts.current.indexOf(id);
        if (index > -1) timeouts.current.splice(index, 1);
    }, []);

    // Clear all
    const clearAll = useCallback(() => {
        const intervalCount = intervals.current.length;
        const timeoutCount = timeouts.current.length;
        
        intervals.current.forEach(id => clearInterval(id));
        timeouts.current.forEach(id => clearTimeout(id));
        intervals.current = [];
        timeouts.current = [];
        
        if (intervalCount + timeoutCount > 0) {
            console.log(`🧹 Cleared ${intervalCount} intervals, ${timeoutCount} timeouts`);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        
        return () => {
            isMounted.current = false;
            clearAll();
        };
    }, [clearAll]);

    return {
        setInterval: safeSetInterval,
        setTimeout: safeSetTimeout,
        clearInterval: clearSafeInterval,
        clearTimeout: clearSafeTimeout,
        clearAll,
        isMounted: () => isMounted.current
    };
}

// ============================================================
// COMBINED CLEANUP HOOK
// ============================================================

/**
 * Master cleanup hook - combines all cleanup utilities
 * Use this in dashboards and pages with multiple subscriptions/timers
 */
export function useCleanup() {
    const subscriptions = useFirestoreSubscriptions();
    const timers = useTimerCleanup();
    const customCleanups = useRef<CleanupFunction[]>([]);
    const isMounted = useRef(true);

    // Add custom cleanup function
    const addCleanup = useCallback((cleanup: CleanupFunction) => {
        customCleanups.current.push(cleanup);
    }, []);

    // Run all cleanups
    const runAllCleanups = useCallback(() => {
        subscriptions.clearAllSubscriptions();
        timers.clearAll();
        
        const customCount = customCleanups.current.length;
        customCleanups.current.forEach(cleanup => {
            try {
                cleanup();
            } catch (e) {
                console.warn('Custom cleanup error:', e);
            }
        });
        customCleanups.current = [];
        
        if (customCount > 0) {
            console.log(`🧹 Ran ${customCount} custom cleanup functions`);
        }
    }, [subscriptions, timers]);

    // Cleanup on unmount
    useEffect(() => {
        isMounted.current = true;
        
        return () => {
            isMounted.current = false;
            runAllCleanups();
            console.log('✅ Page cleanup complete');
        };
    }, [runAllCleanups]);

    return {
        // Subscription management
        addSubscription: subscriptions.addSubscription,
        removeSubscription: subscriptions.removeSubscription,
        
        // Timer management
        setInterval: timers.setInterval,
        setTimeout: timers.setTimeout,
        clearInterval: timers.clearInterval,
        clearTimeout: timers.clearTimeout,
        
        // Custom cleanup
        addCleanup,
        
        // Manual trigger
        runAllCleanups,
        
        // Check if mounted
        isMounted: () => isMounted.current
    };
}

// ============================================================
// EVENT LISTENER CLEANUP
// ============================================================

/**
 * Hook for managing event listeners with automatic cleanup
 */
export function useEventListener<K extends keyof WindowEventMap>(
    eventName: K,
    handler: (event: WindowEventMap[K]) => void,
    element: Window | HTMLElement | null = window,
    options?: boolean | AddEventListenerOptions
) {
    const savedHandler = useRef(handler);

    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(() => {
        if (!element) return;

        const eventListener = (event: Event) => {
            savedHandler.current(event as WindowEventMap[K]);
        };

        element.addEventListener(eventName, eventListener, options);

        return () => {
            element.removeEventListener(eventName, eventListener, options);
        };
    }, [eventName, element, options]);
}

// ============================================================
// DEBOUNCED VALUE WITH CLEANUP
// ============================================================

/**
 * Debounced value hook with proper cleanup
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = React.useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

// Need React import for the last hook
import * as React from 'react';

export default {
    useFirestoreSubscriptions,
    useTimerCleanup,
    useCleanup,
    useEventListener,
    useDebouncedValue
};
