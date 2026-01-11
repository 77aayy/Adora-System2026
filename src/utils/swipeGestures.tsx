/**
 * Swipe Gestures Hook
 * Touch gesture detection for mobile
 * Adora Hotel Management System V2
 */

import { useRef, useCallback, useEffect } from 'react';

// ============================================================
// TYPES
// ============================================================

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
}

export interface SwipeOptions {
    threshold?: number; // Minimum distance for swipe
    timeout?: number;   // Max time for swipe gesture
    preventScroll?: boolean;
}

// ============================================================
// HOOK
// ============================================================

/**
 * React hook for swipe gesture detection
 */
export const useSwipeGesture = (
    handlers: SwipeHandlers,
    options: SwipeOptions = {}
) => {
    const {
        threshold = 50,
        timeout = 500,
        preventScroll = false,
    } = options;

    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);

    const handleTouchStart = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
    }, []);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (preventScroll && touchStartRef.current) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
            const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

            // Prevent scroll if horizontal swipe is detected
            if (deltaX > deltaY && deltaX > 10) {
                e.preventDefault();
            }
        }
    }, [preventScroll]);

    const handleTouchEnd = useCallback((e: TouchEvent) => {
        if (!touchStartRef.current) return;

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;
        const deltaTime = Date.now() - touchStartRef.current.time;

        // Check if gesture is within time limit
        if (deltaTime > timeout) {
            touchStartRef.current = null;
            return;
        }

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Determine swipe direction
        if (absX > threshold || absY > threshold) {
            if (absX > absY) {
                // Horizontal swipe
                if (deltaX > 0) {
                    handlers.onSwipeRight?.();
                } else {
                    handlers.onSwipeLeft?.();
                }
            } else {
                // Vertical swipe
                if (deltaY > 0) {
                    handlers.onSwipeDown?.();
                } else {
                    handlers.onSwipeUp?.();
                }
            }
        }

        touchStartRef.current = null;
    }, [handlers, threshold, timeout]);

    // Bind to element
    const bindSwipe = useCallback((element: HTMLElement | null) => {
        if (elementRef.current) {
            elementRef.current.removeEventListener('touchstart', handleTouchStart);
            elementRef.current.removeEventListener('touchmove', handleTouchMove);
            elementRef.current.removeEventListener('touchend', handleTouchEnd);
        }

        elementRef.current = element;

        if (element) {
            element.addEventListener('touchstart', handleTouchStart, { passive: true });
            element.addEventListener('touchmove', handleTouchMove, { passive: !preventScroll });
            element.addEventListener('touchend', handleTouchEnd, { passive: true });
        }
    }, [handleTouchStart, handleTouchMove, handleTouchEnd, preventScroll]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (elementRef.current) {
                elementRef.current.removeEventListener('touchstart', handleTouchStart);
                elementRef.current.removeEventListener('touchmove', handleTouchMove);
                elementRef.current.removeEventListener('touchend', handleTouchEnd);
            }
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    return { bindSwipe };
};

// ============================================================
// SWIPEABLE COMPONENT
// ============================================================

import React, { ReactNode } from 'react';

interface SwipeableProps {
    children: ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    className?: string;
}

export const Swipeable: React.FC<SwipeableProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    className = '',
}) => {
    const { bindSwipe } = useSwipeGesture({
        onSwipeLeft,
        onSwipeRight,
    });

    return (
        <div ref={bindSwipe} className={className}>
            {children}
        </div>
    );
};

export default useSwipeGesture;
