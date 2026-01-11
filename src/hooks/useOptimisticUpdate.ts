/**
 * useOptimisticUpdate Hook
 * Optimistic UI updates for better UX
 * Adora Hotel Management System
 */

import { useState, useCallback } from 'react';

interface OptimisticUpdateOptions<T> {
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
    rollbackDelay?: number; // Delay before rollback on error (ms)
}

/**
 * Hook for optimistic UI updates
 * Updates UI immediately, then syncs with backend
 * Rolls back on error
 * 
 * @example
 * ```typescript
 * const { execute, isUpdating } = useOptimisticUpdate();
 * 
 * const handleComplete = async (requestId: string) => {
 *   await execute(
 *     // Optimistic update
 *     () => {
 *       setRequests(prev => prev.map(r => 
 *         r.id === requestId ? { ...r, status: 'COMPLETED' } : r
 *       ));
 *     },
 *     // Backend update
 *     () => updateDoc(doc(db, 'requests', requestId), { status: 'COMPLETED' }),
 *     // Rollback
 *     () => {
 *       setRequests(prev => prev.map(r => 
 *         r.id === requestId ? { ...r, status: 'IN_PROGRESS' } : r
 *       ));
 *     }
 *   );
 * };
 * ```
 */
export function useOptimisticUpdate<T = void>(
    options: OptimisticUpdateOptions<T> = {}
) {
    const { onSuccess, onError, rollbackDelay = 0 } = options;
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (
            optimisticUpdate: () => void,
            actualUpdate: () => Promise<T>,
            rollback: () => void
        ): Promise<boolean> => {
            setIsUpdating(true);
            setError(null);

            try {
                // 1. Apply optimistic update immediately
                optimisticUpdate();

                // 2. Perform actual backend update
                const result = await actualUpdate();

                // 3. Success!
                onSuccess?.(result);
                setIsUpdating(false);
                return true;
            } catch (err) {
                const error = err as Error;
                setError(error);

                // 4. Rollback after delay (allows user to see error message)
                if (rollbackDelay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, rollbackDelay));
                }
                rollback();

                onError?.(error);
                setIsUpdating(false);
                return false;
            }
        },
        [onSuccess, onError, rollbackDelay]
    );

    return {
        execute,
        isUpdating,
        error,
    };
}

/**
 * Simpler version for single item updates
 */
export function useOptimisticItemUpdate<T>(
    items: T[],
    setItems: React.Dispatch<React.SetStateAction<T[]>>,
    getId: (item: T) => string,
    options: OptimisticUpdateOptions<void> = {}
) {
    const { execute, isUpdating, error } = useOptimisticUpdate(options);

    const updateItem = useCallback(
        async (
            id: string,
            updates: Partial<T>,
            backendUpdate: () => Promise<void>
        ): Promise<boolean> => {
            // Store original item for rollback
            const originalItem = items.find((item) => getId(item) === id);
            if (!originalItem) return false;

            return execute(
                // Optimistic update
                () => {
                    setItems((prev) =>
                        prev.map((item) =>
                            getId(item) === id ? { ...item, ...updates } : item
                        )
                    );
                },
                // Backend update
                backendUpdate,
                // Rollback
                () => {
                    setItems((prev) =>
                        prev.map((item) =>
                            getId(item) === id ? originalItem : item
                        )
                    );
                }
            );
        },
        [items, setItems, getId, execute]
    );

    const deleteItem = useCallback(
        async (id: string, backendDelete: () => Promise<void>): Promise<boolean> => {
            // Store original item for rollback
            const originalItem = items.find((item) => getId(item) === id);
            if (!originalItem) return false;

            const originalIndex = items.findIndex((item) => getId(item) === id);

            return execute(
                // Optimistic delete
                () => {
                    setItems((prev) => prev.filter((item) => getId(item) !== id));
                },
                // Backend delete
                backendDelete,
                // Rollback
                () => {
                    setItems((prev) => {
                        const newItems = [...prev];
                        newItems.splice(originalIndex, 0, originalItem);
                        return newItems;
                    });
                }
            );
        },
        [items, setItems, getId, execute]
    );

    return {
        updateItem,
        deleteItem,
        isUpdating,
        error,
    };
}

export default useOptimisticUpdate;
