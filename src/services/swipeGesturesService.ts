/**
 * Swipe Gestures Service
 * Migrated from swipe-gestures.js
 * Adora Hotel Management System V2
 * 
 * Touch swipe gestures for cards:
 * - Swipe right: Complete/Confirm action
 * - Swipe left: Delete/Archive action
 */

// ============================================================
// TYPES
// ============================================================

export type SwipeDirection = 'left' | 'right';

export interface SwipeOptions {
    threshold?: number;
    leftText?: string;
    rightText?: string;
    onSwipeLeft?: (id: string, element: HTMLElement) => void;
    onSwipeRight?: (id: string, element: HTMLElement) => void;
}

export interface SwipeState {
    startX: number;
    startY: number;
    element: HTMLElement | null;
    isHorizontal: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_THRESHOLD = 120;
const DEFAULT_LEFT_TEXT = '🗑️ حذف';
const DEFAULT_RIGHT_TEXT = '✅ إنهاء';

// ============================================================
// SWIPE MANAGER
// ============================================================

class SwipeGestureManager {
    private state: SwipeState = {
        startX: 0,
        startY: 0,
        element: null,
        isHorizontal: false
    };
    private threshold = DEFAULT_THRESHOLD;
    private observer: MutationObserver | null = null;

    /**
     * Initialize swipe on elements
     */
    init(selector: string = '.swipeable, .room-card, .request-card', options: SwipeOptions = {}): void {
        if (typeof document === 'undefined') return;

        this.threshold = options.threshold || DEFAULT_THRESHOLD;

        const elements = document.querySelectorAll(selector);

        elements.forEach(element => {
            this.attachToElement(element as HTMLElement, options);
        });

        console.log(`✅ Swipe initialized on ${elements.length} elements`);
    }

    /**
     * Attach swipe handlers to element
     */
    attachToElement(element: HTMLElement, options: SwipeOptions = {}): void {
        if (element.dataset.swipeInit) return;

        element.dataset.swipeInit = 'true';
        element.style.touchAction = 'pan-y';

        element.addEventListener('touchstart', (e) => this.handleStart(e, element), { passive: true });
        element.addEventListener('touchmove', (e) => this.handleMove(e, element, options), { passive: false });
        element.addEventListener('touchend', (e) => this.handleEnd(e, element, options), { passive: true });
        element.addEventListener('touchcancel', () => this.reset(element), { passive: true });
    }

    /**
     * Handle touch start
     */
    private handleStart(event: TouchEvent, element: HTMLElement): void {
        const touch = event.touches[0];
        this.state = {
            startX: touch.clientX,
            startY: touch.clientY,
            element,
            isHorizontal: false
        };
        element.style.transition = 'none';
    }

    /**
     * Handle touch move
     */
    private handleMove(event: TouchEvent, element: HTMLElement, options: SwipeOptions): void {
        if (this.state.element !== element) return;

        const touch = event.touches[0];
        const diffX = touch.clientX - this.state.startX;
        const diffY = touch.clientY - this.state.startY;

        // Determine swipe direction
        if (!this.state.isHorizontal && Math.abs(diffX) > 10) {
            this.state.isHorizontal = Math.abs(diffX) > Math.abs(diffY);
        }

        // Only handle horizontal swipe
        if (this.state.isHorizontal && Math.abs(diffX) > 30) {
            event.preventDefault();

            // Move element
            const translateX = Math.min(Math.max(diffX, -150), 150);
            element.style.transform = `translateX(${translateX}px)`;

            // Change background based on direction
            if (diffX > 0) {
                const intensity = Math.min(diffX / 150, 1);
                element.style.background = `linear-gradient(90deg, 
                    rgba(34, 197, 94, ${intensity * 0.3}), 
                    var(--bg-card))`;
                this.showHint(element, 'right', options.rightText || DEFAULT_RIGHT_TEXT);
            } else {
                const intensity = Math.min(Math.abs(diffX) / 150, 1);
                element.style.background = `linear-gradient(90deg, 
                    var(--bg-card), 
                    rgba(239, 68, 68, ${intensity * 0.3}))`;
                this.showHint(element, 'left', options.leftText || DEFAULT_LEFT_TEXT);
            }
        }
    }

    /**
     * Handle touch end
     */
    private handleEnd(event: TouchEvent, element: HTMLElement, options: SwipeOptions): void {
        if (this.state.element !== element) return;

        const touch = event.changedTouches[0];
        const diffX = touch.clientX - this.state.startX;

        this.hideHint(element);

        if (Math.abs(diffX) > this.threshold) {
            // Haptic feedback
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate([30, 50, 30]);
            }

            const id = element.dataset.id || element.id;

            if (diffX > 0) {
                // Swipe right
                this.animateComplete(element, 'right');
                if (options.onSwipeRight) {
                    setTimeout(() => options.onSwipeRight!(id, element), 300);
                }
                element.dispatchEvent(new CustomEvent('swipeRight', { detail: { id } }));
            } else {
                // Swipe left
                this.animateComplete(element, 'left');
                if (options.onSwipeLeft) {
                    setTimeout(() => options.onSwipeLeft!(id, element), 300);
                }
                element.dispatchEvent(new CustomEvent('swipeLeft', { detail: { id } }));
            }
        } else {
            this.reset(element);
        }

        this.state.element = null;
        this.state.isHorizontal = false;
    }

    /**
     * Reset element
     */
    reset(element: HTMLElement): void {
        element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        element.style.transform = '';
        element.style.background = '';
        this.hideHint(element);
    }

    /**
     * Animate swipe completion
     */
    private animateComplete(element: HTMLElement, direction: SwipeDirection): void {
        const translateX = direction === 'right' ? '100%' : '-100%';

        element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        element.style.transform = `translateX(${translateX})`;
        element.style.opacity = '0';

        setTimeout(() => {
            if (element.parentNode) {
                this.reset(element);
                element.style.opacity = '1';
            }
        }, 350);
    }

    /**
     * Show swipe hint
     */
    private showHint(element: HTMLElement, direction: SwipeDirection, text: string): void {
        let hint = element.querySelector('.swipe-hint') as HTMLElement;

        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'swipe-hint';
            hint.style.cssText = `
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 0.85rem;
                font-weight: 700;
                color: white;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 10;
            `;
            element.style.position = 'relative';
            element.appendChild(hint);
        }

        hint.textContent = text;

        if (direction === 'right') {
            hint.style.left = '10px';
            hint.style.right = 'auto';
            hint.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        } else {
            hint.style.right = '10px';
            hint.style.left = 'auto';
            hint.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';
        }

        hint.style.opacity = '1';
    }

    /**
     * Hide swipe hint
     */
    private hideHint(element: HTMLElement): void {
        const hint = element.querySelector('.swipe-hint') as HTMLElement;
        if (hint) {
            hint.style.opacity = '0';
            setTimeout(() => hint.remove(), 200);
        }
    }

    /**
     * Set threshold
     */
    setThreshold(value: number): void {
        this.threshold = value;
    }

    /**
     * Observe new elements
     */
    observe(selector: string = '.swipeable, .room-card, .request-card', options: SwipeOptions = {}): void {
        if (typeof MutationObserver === 'undefined') return;

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        const element = node as HTMLElement;
                        if (element.matches && element.matches(selector)) {
                            this.attachToElement(element, options);
                        }
                    }
                });
            });
        });

        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Stop observing
     */
    disconnect(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    }
}

// ============================================================
// SINGLETON
// ============================================================

export const swipeGestures = new SwipeGestureManager();

// ============================================================
// REACT HOOK
// ============================================================

import { useEffect, useCallback, useRef } from 'react';

interface UseSwipeGesturesOptions extends SwipeOptions {
    enabled?: boolean;
}

interface UseSwipeGesturesReturn {
    ref: React.RefObject<HTMLElement>;
    reset: () => void;
}

export const useSwipeGestures = (options: UseSwipeGesturesOptions = {}): UseSwipeGesturesReturn => {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!ref.current || options.enabled === false) return;

        swipeGestures.attachToElement(ref.current, options);

        return () => {
            if (ref.current) {
                ref.current.dataset.swipeInit = '';
            }
        };
    }, [options.enabled]);

    const reset = useCallback(() => {
        if (ref.current) {
            swipeGestures.reset(ref.current);
        }
    }, []);

    return { ref, reset };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    swipeGestures,
    useSwipeGestures
};
