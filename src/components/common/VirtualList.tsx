/**
 * Virtual List Component
 * Efficient rendering of large lists
 * Adora Hotel Management System V3
 */

import React, { ReactNode } from 'react';
import { useVirtualList } from '../../hooks/useVirtualList';

interface VirtualListProps<T> {
    items: T[];
    itemHeight: number;
    containerHeight?: number;
    overscan?: number;
    renderItem: (item: T, index: number) => ReactNode;
    className?: string;
    emptyMessage?: string;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
    const {
        items,
        itemHeight,
        containerHeight = 400,
        overscan = 3,
        renderItem,
        className = '',
        emptyMessage = 'لا توجد عناصر',
    } = props;

    const { virtualItems, totalHeight, containerRef } = useVirtualList({
        items,
        itemHeight,
        containerHeight,
        overscan,
    });

    if (items.length === 0) {
        return (
            <div className={`flex items-center justify-center p-8 text-white/40 ${className}`}>
                {emptyMessage}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`overflow-auto ${className}`}
            style={{ height: containerHeight }}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                {virtualItems.map(({ index, item, offset }) => (
                    <div
                        key={index}
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
            </div>
        </div>
    );
}
