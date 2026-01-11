/**
 * Optimized List Component
 * Adora Hotel Management System
 * 
 * ⚡ Virtualized list for rendering large datasets efficiently
 * Uses windowing to only render visible items
 */

import React, { useRef, useState, useEffect, useCallback, memo } from 'react';

// ============================================================
// TYPES
// ============================================================

interface OptimizedListProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    itemHeight: number | ((item: T, index: number) => number);
    containerHeight: number;
    overscan?: number;
    className?: string;
    emptyMessage?: string;
    keyExtractor?: (item: T, index: number) => string;
}

interface VirtualItem {
    index: number;
    start: number;
    height: number;
}

// ============================================================
// OPTIMIZED LIST COMPONENT
// ============================================================

function OptimizedListInner<T>({
    items,
    renderItem,
    itemHeight,
    containerHeight,
    overscan = 3,
    className = '',
    emptyMessage = 'لا توجد بيانات',
    keyExtractor = (_, index) => String(index)
}: OptimizedListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);

    // Calculate item heights
    const getItemHeight = useCallback((item: T, index: number): number => {
        return typeof itemHeight === 'function' ? itemHeight(item, index) : itemHeight;
    }, [itemHeight]);

    // Calculate total height and visible items
    const { virtualItems, totalHeight, startIndex, endIndex } = React.useMemo(() => {
        if (items.length === 0) {
            return { virtualItems: [], totalHeight: 0, startIndex: 0, endIndex: 0 };
        }

        // Calculate all item positions
        const positions: VirtualItem[] = [];
        let currentTop = 0;

        for (let i = 0; i < items.length; i++) {
            const height = getItemHeight(items[i], i);
            positions.push({
                index: i,
                start: currentTop,
                height
            });
            currentTop += height;
        }

        const totalHeight = currentTop;

        // Find visible range
        let startIdx = 0;
        let endIdx = items.length - 1;

        for (let i = 0; i < positions.length; i++) {
            if (positions[i].start + positions[i].height >= scrollTop) {
                startIdx = Math.max(0, i - overscan);
                break;
            }
        }

        for (let i = positions.length - 1; i >= 0; i--) {
            if (positions[i].start <= scrollTop + containerHeight) {
                endIdx = Math.min(items.length - 1, i + overscan);
                break;
            }
        }

        return {
            virtualItems: positions.slice(startIdx, endIdx + 1),
            totalHeight,
            startIndex: startIdx,
            endIndex: endIdx
        };
    }, [items, getItemHeight, scrollTop, containerHeight, overscan]);

    // Handle scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    // Empty state
    if (items.length === 0) {
        return (
            <div className={`flex items-center justify-center py-12 text-white/60 ${className}`}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                {virtualItems.map(({ index, start, height }) => (
                    <div
                        key={keyExtractor(items[index], index)}
                        style={{
                            position: 'absolute',
                            top: start,
                            left: 0,
                            right: 0,
                            height
                        }}
                    >
                        {renderItem(items[index], index)}
                    </div>
                ))}
            </div>
        </div>
    );
}

export const OptimizedList = memo(OptimizedListInner) as typeof OptimizedListInner;

// ============================================================
// SIMPLE WINDOWED LIST (Simpler alternative)
// ============================================================

interface WindowedListProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    pageSize?: number;
    className?: string;
    emptyMessage?: string;
    loadMoreLabel?: string;
}

function WindowedListInner<T>({
    items,
    renderItem,
    pageSize = 20,
    className = '',
    emptyMessage = 'لا توجد بيانات',
    loadMoreLabel = 'عرض المزيد'
}: WindowedListProps<T>) {
    const [visibleCount, setVisibleCount] = useState(pageSize);

    const showMore = useCallback(() => {
        setVisibleCount(prev => Math.min(prev + pageSize, items.length));
    }, [pageSize, items.length]);

    // Reset when items change
    useEffect(() => {
        setVisibleCount(pageSize);
    }, [items.length, pageSize]);

    if (items.length === 0) {
        return (
            <div className={`flex items-center justify-center py-12 text-white/60 ${className}`}>
                {emptyMessage}
            </div>
        );
    }

    const visibleItems = items.slice(0, visibleCount);
    const hasMore = visibleCount < items.length;

    return (
        <div className={className}>
            {visibleItems.map((item, index) => (
                <React.Fragment key={index}>
                    {renderItem(item, index)}
                </React.Fragment>
            ))}
            
            {hasMore && (
                <button
                    onClick={showMore}
                    className="w-full py-3 mt-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 transition-colors"
                >
                    {loadMoreLabel} ({items.length - visibleCount} متبقي)
                </button>
            )}
        </div>
    );
}

export const WindowedList = memo(WindowedListInner) as typeof WindowedListInner;

// ============================================================
// MEMOIZED ITEM WRAPPER
// ============================================================

interface MemoizedItemProps {
    children: React.ReactNode;
    deps?: any[];
}

/**
 * Wrapper to memoize list items based on specific dependencies
 */
export const MemoizedItem: React.FC<MemoizedItemProps> = memo(
    ({ children }) => <>{children}</>,
    (prevProps, nextProps) => {
        // Deep compare deps
        if (!prevProps.deps || !nextProps.deps) return false;
        if (prevProps.deps.length !== nextProps.deps.length) return false;
        return prevProps.deps.every((dep, i) => dep === nextProps.deps?.[i]);
    }
);

// ============================================================
// DEFERRED RENDERING COMPONENT
// ============================================================

interface DeferredProps {
    children: React.ReactNode;
    delay?: number;
    fallback?: React.ReactNode;
}

/**
 * Defer rendering of non-critical content
 * Useful for heavy components that don't need to render immediately
 */
export function Deferred({ children, delay = 100, fallback = null }: DeferredProps) {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShouldRender(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    if (!shouldRender) return <>{fallback}</>;
    return <>{children}</>;
}

// ============================================================
// INTERSECTION OBSERVER LAZY RENDER
// ============================================================

interface LazyRenderProps {
    children: React.ReactNode;
    placeholder?: React.ReactNode;
    rootMargin?: string;
}

/**
 * Only render children when they enter the viewport
 */
export function LazyRender({ children, placeholder = null, rootMargin = '100px' }: LazyRenderProps) {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin }
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [rootMargin]);

    return (
        <div ref={ref}>
            {isVisible ? children : placeholder}
        </div>
    );
}
