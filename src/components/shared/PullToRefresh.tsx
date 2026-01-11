/**
 * Pull to Refresh Component
 * Native-like pull to refresh functionality
 * Adora Hotel Management System V2
 */

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { haptic, playSound } from '../../utils/uxEffects';

interface PullToRefreshProps {
    onRefresh: () => Promise<void> | void;
    children: React.ReactNode;
    threshold?: number; // Distance to pull before triggering (default: 80px)
    className?: string;
    enabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
    onRefresh,
    children,
    threshold = 80,
    className = '',
    enabled = true,
}) => {
    const [isPulling, setIsPulling] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const startYRef = useRef<number>(0);
    const currentYRef = useRef<number>(0);

    const handleTouchStart = (e: TouchEvent) => {
        if (!enabled || !containerRef.current) return;
        
        const container = containerRef.current;
        // Only trigger if at the top of the scroll
        if (container.scrollTop === 0) {
            startYRef.current = e.touches[0].clientY;
            currentYRef.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (!enabled || !isPulling || !containerRef.current) return;

        currentYRef.current = e.touches[0].clientY;
        const distance = currentYRef.current - startYRef.current;

        if (distance > 0) {
            // Prevent default scroll
            e.preventDefault();
            
            const maxPull = threshold * 1.5; // Allow slight overscroll
            const normalizedDistance = Math.min(distance, maxPull);
            setPullDistance(normalizedDistance);

            // Haptic feedback when threshold reached
            if (normalizedDistance >= threshold && normalizedDistance < threshold + 10) {
                haptic('light');
            }
        } else {
            setIsPulling(false);
            setPullDistance(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!enabled || !isPulling) return;

        if (pullDistance >= threshold) {
            setIsRefreshing(true);
            haptic('medium');
            playSound('notification');

            try {
                await onRefresh();
            } catch (error) {
                console.error('Pull to refresh error:', error);
            } finally {
                setIsRefreshing(false);
                setIsPulling(false);
                setPullDistance(0);
            }
        } else {
            // Snap back
            setIsPulling(false);
            setPullDistance(0);
        }
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container || !enabled) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd);

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [enabled, isPulling, pullDistance]);

    const pullProgress = Math.min(pullDistance / threshold, 1);
    const rotation = pullProgress * 360;

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Pull to Refresh Indicator */}
            {(isPulling || isRefreshing) && (
                <div
                    className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-4 transition-all duration-200"
                    style={{
                        transform: `translateY(${Math.max(0, pullDistance - 20)}px)`,
                        opacity: Math.min(pullProgress, 1),
                    }}
                >
                    <div className="glass-card px-4 py-2 rounded-full flex items-center gap-2">
                        <RefreshCw
                            className={`w-5 h-5 text-primary-400 ${
                                isRefreshing ? 'animate-spin' : ''
                            }`}
                            style={{
                                transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                            }}
                        />
                        <span className="text-sm text-white/80">
                            {pullDistance >= threshold ? 'حرر للتحديث' : 'اسحب للتحديث'}
                        </span>
                    </div>
                </div>
            )}

            {/* Content */}
            <div
                style={{
                    transform: `translateY(${isPulling ? Math.max(0, pullDistance) : 0}px)`,
                    transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default PullToRefresh;
