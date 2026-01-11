/**
 * Virtualized Request List Component
 * High-performance list for large datasets
 * Adora Hotel Management System - SaaS
 * 
 * ✅ SAFE: New component, doesn't modify existing code
 * ✅ BENEFIT: Renders 1000+ items smoothly
 * 
 * @example
 * ```tsx
 * <VirtualizedRequestList
 *   requests={requests}
 *   onItemClick={(req) => setSelected(req)}
 *   renderItem={(req) => <RequestCard request={req} />}
 *   itemHeight={120}
 *   maxHeight={600}
 *   emptyMessage="لا توجد طلبات"
 * />
 * ```
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { Loader } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface VirtualizedRequestListProps<T> {
    /** Array of items to render */
    items: T[];
    /** Render function for each item */
    renderItem: (item: T, index: number) => React.ReactNode;
    /** Height of each item in pixels */
    itemHeight?: number;
    /** Maximum height of the list container */
    maxHeight?: number;
    /** Message when list is empty */
    emptyMessage?: string;
    /** Show loading state */
    loading?: boolean;
    /** Called when scrolled near bottom (for infinite scroll) */
    onLoadMore?: () => void;
    /** Threshold for triggering onLoadMore (pixels from bottom) */
    loadMoreThreshold?: number;
    /** Custom class for container */
    className?: string;
    /** Key extractor for items */
    getKey?: (item: T, index: number) => string | number;
}

// ============================================================
// COMPONENT
// ============================================================

export function VirtualizedRequestList<T>({
    items,
    renderItem,
    itemHeight = 100,
    maxHeight = 600,
    emptyMessage = 'لا توجد عناصر',
    loading = false,
    onLoadMore,
    loadMoreThreshold = 200,
    className = '',
    getKey = (_, index) => index,
}: VirtualizedRequestListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    
    // Calculate visible range
    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(maxHeight / itemHeight);
    const overscan = 5; // Extra items to render above/below
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + maxHeight) / itemHeight) + overscan
    );
    
    // Memoize visible items
    const visibleItems = useMemo(() => {
        return items.slice(startIndex, endIndex).map((item, i) => ({
            item,
            index: startIndex + i,
            offset: (startIndex + i) * itemHeight,
        }));
    }, [items, startIndex, endIndex, itemHeight]);
    
    // Handle scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        setScrollTop(target.scrollTop);
        
        // Trigger load more
        if (onLoadMore) {
            const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
            if (scrollBottom < loadMoreThreshold) {
                onLoadMore();
            }
        }
    }, [onLoadMore, loadMoreThreshold]);
    
    // Loading state
    if (loading && items.length === 0) {
        return (
            <div className={`flex items-center justify-center p-8 ${className}`} style={{ height: maxHeight }}>
                <Loader className="w-8 h-8 text-teal-400 animate-spin" />
            </div>
        );
    }
    
    // Empty state
    if (!loading && items.length === 0) {
        return (
            <div className={`flex items-center justify-center p-8 text-slate-400 ${className}`} style={{ height: maxHeight }}>
                {emptyMessage}
            </div>
        );
    }
    
    return (
        <div
            ref={containerRef}
            className={`overflow-y-auto overflow-x-hidden ${className}`}
            style={{ height: maxHeight }}
            onScroll={handleScroll}
        >
            {/* Spacer for total height */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Render only visible items */}
                {visibleItems.map(({ item, index, offset }) => (
                    <div
                        key={getKey(item, index)}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            transform: `translateY(${offset}px)`,
                            height: itemHeight,
                        }}
                    >
                        {renderItem(item, index)}
                    </div>
                ))}
                
                {/* Loading indicator at bottom */}
                {loading && items.length > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 50,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Loader className="w-5 h-5 text-teal-400 animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================
// SIMPLE LIST (for smaller lists)
// ============================================================

/**
 * Simple windowed list for medium-sized lists (50-200 items)
 * Uses CSS containment for better performance
 */
export function WindowedList<T>({
    items,
    renderItem,
    maxHeight = 400,
    className = '',
    emptyMessage = 'لا توجد عناصر',
}: {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    maxHeight?: number;
    className?: string;
    emptyMessage?: string;
}) {
    if (items.length === 0) {
        return (
            <div className={`flex items-center justify-center p-8 text-slate-400 ${className}`}>
                {emptyMessage}
            </div>
        );
    }
    
    return (
        <div
            className={`overflow-y-auto ${className}`}
            style={{ 
                maxHeight,
                contain: 'content', // CSS containment for better perf
            }}
        >
            {items.map((item, index) => (
                <div key={index} style={{ contain: 'layout style' }}>
                    {renderItem(item, index)}
                </div>
            ))}
        </div>
    );
}

// ============================================================
// EXPORTS
// ============================================================

export default VirtualizedRequestList;
