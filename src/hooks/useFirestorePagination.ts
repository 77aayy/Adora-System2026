/**
 * useFirestorePagination Hook
 * Efficient pagination for Firestore queries
 * Adora Hotel Management System
 */

import { useState, useCallback, useEffect } from 'react';
import {
    Query,
    QueryConstraint,
    DocumentSnapshot,
    getDocs,
    query,
    limit,
    startAfter,
    limitToLast,
    endBefore,
} from 'firebase/firestore';

interface UsePaginationOptions<T> {
    pageSize?: number;
    onSuccess?: (data: T[]) => void;
    onError?: (error: Error) => void;
}

interface UsePaginationResult<T> {
    data: T[];
    loading: boolean;
    error: Error | null;
    hasMore: boolean;
    hasPrevious: boolean;
    loadMore: () => Promise<void>;
    loadPrevious: () => Promise<void>;
    refresh: () => Promise<void>;
    totalLoaded: number;
}

/**
 * Hook for paginated Firestore queries
 * 
 * @example
 * ```typescript
 * const requestsQuery = query(
 *   collection(db, 'requests'),
 *   where('tenantId', '==', tenantId),
 *   orderBy('createdAt', 'desc')
 * );
 * 
 * const { data, loading, hasMore, loadMore } = useFirestorePagination(
 *   requestsQuery,
 *   (doc) => ({ id: doc.id, ...doc.data() }),
 *   { pageSize: 50 }
 * );
 * ```
 */
export function useFirestorePagination<T>(
    baseQuery: Query,
    transformer: (doc: DocumentSnapshot) => T,
    options: UsePaginationOptions<T> = {}
): UsePaginationResult<T> {
    const { pageSize = 50, onSuccess, onError } = options;

    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [firstDoc, setFirstDoc] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [hasPrevious, setHasPrevious] = useState(false);

    // Load initial page
    const loadInitial = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const q = query(baseQuery, limit(pageSize));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setData([]);
                setHasMore(false);
                setLoading(false);
                return;
            }

            const items = snapshot.docs.map(transformer);
            setData(items);
            setFirstDoc(snapshot.docs[0]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === pageSize);
            setHasPrevious(false);

            onSuccess?.(items);
        } catch (err) {
            const error = err as Error;
            setError(error);
            onError?.(error);
        } finally {
            setLoading(false);
        }
    }, [baseQuery, pageSize, transformer, onSuccess, onError]);

    // Load more (next page)
    const loadMore = useCallback(async () => {
        if (!hasMore || !lastDoc || loading) return;

        setLoading(true);
        setError(null);

        try {
            const q = query(baseQuery, startAfter(lastDoc), limit(pageSize));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setHasMore(false);
                setLoading(false);
                return;
            }

            const items = snapshot.docs.map(transformer);
            setData((prev) => [...prev, ...items]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === pageSize);
            setHasPrevious(true);

            onSuccess?.(items);
        } catch (err) {
            const error = err as Error;
            setError(error);
            onError?.(error);
        } finally {
            setLoading(false);
        }
    }, [baseQuery, pageSize, lastDoc, hasMore, loading, transformer, onSuccess, onError]);

    // Load previous page
    const loadPrevious = useCallback(async () => {
        if (!hasPrevious || !firstDoc || loading) return;

        setLoading(true);
        setError(null);

        try {
            const q = query(baseQuery, endBefore(firstDoc), limitToLast(pageSize));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setHasPrevious(false);
                setLoading(false);
                return;
            }

            const items = snapshot.docs.map(transformer);
            setData((prev) => [...items, ...prev]);
            setFirstDoc(snapshot.docs[0]);
            setHasPrevious(snapshot.docs.length === pageSize);
            setHasMore(true);

            onSuccess?.(items);
        } catch (err) {
            const error = err as Error;
            setError(error);
            onError?.(error);
        } finally {
            setLoading(false);
        }
    }, [baseQuery, pageSize, firstDoc, hasPrevious, loading, transformer, onSuccess, onError]);

    // Refresh (reload from beginning)
    const refresh = useCallback(async () => {
        setData([]);
        setLastDoc(null);
        setFirstDoc(null);
        setHasMore(true);
        setHasPrevious(false);
        await loadInitial();
    }, [loadInitial]);

    // Load initial data on mount
    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    return {
        data,
        loading,
        error,
        hasMore,
        hasPrevious,
        loadMore,
        loadPrevious,
        refresh,
        totalLoaded: data.length,
    };
}

export default useFirestorePagination;
