/**
 * Focus Management Hook
 * Handles focus trapping in modals and accessibility improvements
 * Adora Hotel Management System V2
 */

import { useEffect, useRef, RefObject } from 'react';

interface UseFocusManagementOptions {
    isOpen: boolean;
    autoFocus?: boolean;
    trapFocus?: boolean;
    returnFocus?: boolean;
    initialFocusRef?: RefObject<HTMLElement>;
    finalFocusRef?: RefObject<HTMLElement>;
}

/**
 * Hook for managing focus in modals and dialogs
 */
export const useFocusManagement = ({
    isOpen,
    autoFocus = true,
    trapFocus = true,
    returnFocus = true,
    initialFocusRef,
    finalFocusRef,
}: UseFocusManagementOptions) => {
    const containerRef = useRef<HTMLElement>(null);
    const previousActiveElementRef = useRef<HTMLElement | null>(null);

    // Save the element that had focus before opening
    useEffect(() => {
        if (isOpen) {
            previousActiveElementRef.current = document.activeElement as HTMLElement;
        }
    }, [isOpen]);

    // Auto-focus first focusable element
    useEffect(() => {
        if (!isOpen || !autoFocus) return;

        const timer = setTimeout(() => {
            if (initialFocusRef?.current) {
                initialFocusRef.current.focus();
            } else if (containerRef.current) {
                const firstFocusable = containerRef.current.querySelector(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                ) as HTMLElement;
                firstFocusable?.focus();
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [isOpen, autoFocus, initialFocusRef]);

    // Return focus to previous element when closing
    useEffect(() => {
        if (!isOpen && returnFocus && previousActiveElementRef.current) {
            const timer = setTimeout(() => {
                previousActiveElementRef.current?.focus();
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isOpen, returnFocus]);

    // Trap focus within modal
    useEffect(() => {
        if (!isOpen || !trapFocus || !containerRef.current) return;

        const container = containerRef.current;

        const getFocusableElements = (): HTMLElement[] => {
            const selector = [
                'button:not([disabled])',
                '[href]',
                'input:not([disabled])',
                'select:not([disabled])',
                'textarea:not([disabled])',
                '[tabindex]:not([tabindex="-1"])',
            ].join(', ');

            return Array.from(container.querySelectorAll<HTMLElement>(selector));
        };

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;

            const focusableElements = getFocusableElements();
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            const currentElement = document.activeElement as HTMLElement;

            if (e.shiftKey) {
                // Shift + Tab
                if (currentElement === firstElement || !focusableElements.includes(currentElement)) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (currentElement === lastElement || !focusableElements.includes(currentElement)) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Focus management will be handled by the close handler
                if (finalFocusRef?.current) {
                    finalFocusRef.current.focus();
                }
            }
        };

        container.addEventListener('keydown', handleTabKey);
        container.addEventListener('keydown', handleEscape);

        return () => {
            container.removeEventListener('keydown', handleTabKey);
            container.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, trapFocus, finalFocusRef]);

    return {
        containerRef,
        previousActiveElement: previousActiveElementRef.current,
    };
};

/**
 * Hook for scroll lock when modal is open
 */
export const useScrollLock = (isLocked: boolean) => {
    useEffect(() => {
        if (!isLocked) return;

        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, [isLocked]);
};

/**
 * Hook for clicking outside to close
 */
export const useClickOutside = (
    ref: RefObject<HTMLElement>,
    handler: () => void,
    enabled = true
) => {
    useEffect(() => {
        if (!enabled) return;

        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                handler();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [ref, handler, enabled]);
};

export default useFocusManagement;
