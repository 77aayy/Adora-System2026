/**
 * Virtual List Hook
 * Efficient rendering of large lists using virtualization
 * Adora Hotel Management System V3
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface VirtualListOptions<T> {
    items: T[];
    itemHeight: number;
    containerHeight: number;
    overscan?: number; // Number of items to render outside visible area
}

interface VirtualListResult<T> {
    virtualItems: Array<{ index: number; item: T; offset: number }>;
    totalHeight: number;
    scrollOffset: number;
    containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Virtual List Hook for efficient rendering of large lists
 */
export function useVirtualList<T>(options: VirtualListOptions<T>): VirtualListResult<T> {
    const { items, itemHeight, containerHeight, overscan = 3 } = options;
    const [scrollOffset, setScrollOffset] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollOffset + containerHeight) / itemHeight) + overscan
    );

    const virtualItems = useMemo(() => {
        const result: Array<{ index: number; item: T; offset: number }> = [];

        for (let i = startIndex; i <= endIndex; i++) {
            result.push({
                index: i,
                item: items[i],
                offset: i * itemHeight,
            });
        }

        return result;
    }, [items, startIndex, endIndex, itemHeight]);

    const handleScroll = useCallback((e: Event) => {
        const target = e.target as HTMLDivElement;
        setScrollOffset(target.scrollTop);
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    return {
        virtualItems,
        totalHeight,
        scrollOffset,
        containerRef,
    };
}
