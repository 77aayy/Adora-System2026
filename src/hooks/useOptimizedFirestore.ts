/**
 * useOptimizedFirestore Hook
 * Hook ذكي للتعامل مع Firestore بأقل استهلاك ممكن
 * 
 * ✅ Features:
 * - Auto caching
 * - Deduplication
 * - Throttling
 * - Batch writes
 * 
 * Adora Hotel Management System V3
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    smartGetDoc,
    smartQuery,
    queueWrite,
    smartListen,
    getCache,
    setCache,
    CACHE_TTL,
    getUsageReport
} from '../services/firebaseOptimizationService';
import { QueryConstraint } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface UseDocOptions<T> {
    ttl?: number;
    enabled?: boolean;
    initialData?: T;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
}

interface UseQueryOptions<T> extends UseDocOptions<T[]> {
    constraints?: QueryConstraint[];
    cacheKey?: string;
}

interface UseRealtimeOptions<T> {
    constraints?: QueryConstraint[];
    debounceMs?: number;
    enabled?: boolean;
    onData?: (data: T[]) => void;
}

// ============================================================
// useOptimizedDoc - قراءة document واحد مع cache
// ============================================================

export function useOptimizedDoc<T>(
    path: string | null,
    options: UseDocOptions<T> = {}
) {
    const {
        ttl = CACHE_TTL.settings,
        enabled = true,
        initialData,
        onSuccess,
        onError
    } = options;

    const [data, setData] = useState<T | null>(initialData || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetch = useCallback(async () => {
        if (!path || !enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await smartGetDoc<T>(path, ttl);
            setData(result);
            if (result && onSuccess) onSuccess(result);
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Unknown error');
            setError(err);
            if (onError) onError(err);
        } finally {
            setLoading(false);
        }
    }, [path, ttl, enabled, onSuccess, onError]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    const refetch = useCallback(() => {
        // Clear cache and refetch
        if (path) {
            const cacheKey = path.replace(/\//g, '_');
            localStorage.removeItem(`adora_cache_${cacheKey}`);
        }
        fetch();
    }, [path, fetch]);

    return { data, loading, error, refetch };
}

// ============================================================
// useOptimizedQuery - Query مع cache
// ============================================================

export function useOptimizedQuery<T>(
    collectionPath: string | null,
    options: UseQueryOptions<T> = {}
) {
    const {
        constraints = [],
        ttl = CACHE_TTL.requests,
        cacheKey,
        enabled = true,
        initialData,
        onSuccess,
        onError
    } = options;

    const [data, setData] = useState<T[]>(initialData || []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Memoize constraints string for dependency
    const constraintsKey = JSON.stringify(constraints.map(c => c.toString()));

    const fetch = useCallback(async () => {
        if (!collectionPath || !enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await smartQuery<T>(collectionPath, constraints, ttl, cacheKey);
            setData(result);
            if (onSuccess) onSuccess(result);
        } catch (e) {
            const err = e instanceof Error ? e : new Error('Unknown error');
            setError(err);
            if (onError) onError(err);
        } finally {
            setLoading(false);
        }
    }, [collectionPath, constraintsKey, ttl, cacheKey, enabled]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    const refetch = useCallback(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch };
}

// ============================================================
// useOptimizedRealtime - Real-time listener مع deduplication
// ============================================================

export function useOptimizedRealtime<T>(
    id: string,
    collectionPath: string | null,
    options: UseRealtimeOptions<T> = {}
) {
    const {
        constraints = [],
        debounceMs = 100,
        enabled = true,
        onData
    } = options;

    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!collectionPath || !enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);

        unsubscribeRef.current = smartListen(id, {
            path: collectionPath,
            constraints,
            debounceMs,
            callback: (newData) => {
                setData(newData as T[]);
                setLoading(false);
                if (onData) onData(newData as T[]);
            }
        });

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, [id, collectionPath, enabled, debounceMs]);

    return { data, loading };
}

// ============================================================
// useOptimizedMutation - Write operations مع batching
// ============================================================

export function useOptimizedMutation() {
    const [loading, setLoading] = useState(false);

    const mutate = useCallback(async (
        path: string,
        data: any,
        operation: 'set' | 'update' | 'delete' = 'set'
    ) => {
        setLoading(true);
        queueWrite(path, data, operation);
        setLoading(false);
    }, []);

    const mutateAsync = useCallback(async (
        path: string,
        data: any,
        operation: 'set' | 'update' | 'delete' = 'set'
    ): Promise<void> => {
        return new Promise((resolve) => {
            queueWrite(path, data, operation);
            // Since writes are batched, we resolve immediately
            // The actual write happens in the background
            resolve();
        });
    }, []);

    return { mutate, mutateAsync, loading };
}

// ============================================================
// useFirebaseUsage - مراقبة الاستهلاك
// ============================================================

export function useFirebaseUsage() {
    const [report, setReport] = useState(getUsageReport());

    useEffect(() => {
        // Update every minute
        const interval = setInterval(() => {
            setReport(getUsageReport());
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    return report;
}

// ============================================================
// useCachedValue - قيمة من الكاش فقط (بدون Firebase)
// ============================================================

export function useCachedValue<T>(key: string, defaultValue: T): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(() => {
        const cached = getCache<T>(key);
        return cached !== null ? cached : defaultValue;
    });

    const updateValue = useCallback((newValue: T) => {
        setValue(newValue);
        setCache(key, newValue, CACHE_TTL.settings);
    }, [key]);

    return [value, updateValue];
}

export default {
    useOptimizedDoc,
    useOptimizedQuery,
    useOptimizedRealtime,
    useOptimizedMutation,
    useFirebaseUsage,
    useCachedValue
};
