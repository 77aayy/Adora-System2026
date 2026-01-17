/**
 * Scroll Animation Hook
 * Inspired by juleb.com/ar - Smooth fade-in animations on scroll
 * ✅ Architecture: Reusable hook for scroll-triggered animations
 */

import { useEffect, useRef, useState } from 'react';

interface UseScrollAnimationOptions {
    threshold?: number; // 0-1, default 0.1 (10% visible)
    rootMargin?: string; // default '0px'
    triggerOnce?: boolean; // default true
    delay?: number; // milliseconds
}

/**
 * Hook to trigger animations when element enters viewport
 * Returns ref to attach to element and isVisible state
 */
export const useScrollAnimation = (options: UseScrollAnimationOptions = {}) => {
    const {
        threshold = 0.1,
        rootMargin = '0px',
        triggerOnce = true,
        delay = 0
    } = options;

    const [isVisible, setIsVisible] = useState(false);
    const [hasAnimated, setHasAnimated] = useState(false);
    const elementRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // Skip if already animated and triggerOnce is true
        if (hasAnimated && triggerOnce) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Apply delay if specified
                        if (delay > 0) {
                            setTimeout(() => {
                                setIsVisible(true);
                                if (triggerOnce) setHasAnimated(true);
                            }, delay);
                        } else {
                            setIsVisible(true);
                            if (triggerOnce) setHasAnimated(true);
                        }
                    } else if (!triggerOnce) {
                        setIsVisible(false);
                    }
                });
            },
            {
                threshold,
                rootMargin
            }
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [threshold, rootMargin, triggerOnce, delay, hasAnimated]);

    return { ref: elementRef, isVisible };
};

/**
 * Hook for counter animation (numbers counting up)
 */
export const useCounterAnimation = (
    targetValue: number,
    duration: number = 2000,
    startOnVisible: boolean = true
) => {
    const [count, setCount] = useState(0);
    const { ref, isVisible } = useScrollAnimation({ triggerOnce: true });

    useEffect(() => {
        if (!startOnVisible || isVisible) {
            let startTime: number | null = null;
            const startValue = 0;

            const animate = (currentTime: number) => {
                if (!startTime) startTime = currentTime;
                const progress = Math.min((currentTime - startTime) / duration, 1);

                // Easing function (ease-out)
                const easeOut = 1 - Math.pow(1 - progress, 3);
                const currentCount = Math.floor(startValue + (targetValue - startValue) * easeOut);

                setCount(currentCount);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    setCount(targetValue); // Ensure final value
                }
            };

            requestAnimationFrame(animate);
        }
    }, [targetValue, duration, isVisible, startOnVisible]);

    return { count, ref, isVisible };
};
