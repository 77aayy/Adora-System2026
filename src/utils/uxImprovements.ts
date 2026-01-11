/**
 * UX Improvements Utility
 * Helper functions for enhanced user experience
 * Adora Hotel Management System V2
 */

import { haptic, playSound } from './uxEffects';

/**
 * Enhanced button click handler with feedback
 */
export const handleButtonClick = (
    callback: () => void | Promise<void>,
    options?: {
        hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'error';
        soundType?: 'click' | 'success' | 'error' | 'notification';
        preventDoubleClick?: boolean;
    }
) => {
    return async (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();

        const {
            hapticType = 'light',
            soundType = 'click',
            preventDoubleClick = true,
        } = options || {};

        // Prevent double clicks
        if (preventDoubleClick && (e?.currentTarget as HTMLButtonElement)?.disabled) {
            return;
        }

        // Disable button temporarily
        if (preventDoubleClick && e?.currentTarget) {
            (e.currentTarget as HTMLButtonElement).disabled = true;
        }

        // Haptic and sound feedback
        haptic(hapticType);
        playSound(soundType);

        try {
            await callback();
        } catch (error) {
            console.error('Button action error:', error);
            haptic('error');
            playSound('error');
        } finally {
            // Re-enable button after delay
            if (preventDoubleClick && e?.currentTarget) {
                setTimeout(() => {
                    (e.currentTarget as HTMLButtonElement).disabled = false;
                }, 500);
            }
        }
    };
};

/**
 * Smooth scroll to element
 */
export const smoothScrollTo = (
    element: HTMLElement | null,
    options?: ScrollIntoViewOptions
) => {
    if (!element) return;

    element.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
        ...options,
    });
};

/**
 * Copy to clipboard with feedback
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        haptic('success');
        playSound('success');
        return true;
    } catch (error) {
        console.error('Copy to clipboard error:', error);
        haptic('error');
        playSound('error');
        return false;
    }
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};

/**
 * Format number with commas
 */
export const formatNumber = (num: number): string => {
    return num.toLocaleString('ar-SA');
};

/**
 * Format date in Arabic
 */
export const formatDateArabic = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

/**
 * Format time in Arabic
 */
export const formatTimeArabic = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
    });
};

/**
 * Get relative time (e.g., "منذ دقيقتين")
 */
export const getRelativeTime = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return formatDateArabic(d);
};

/**
 * Validate email
 */
export const isValidEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

/**
 * Validate phone number (Saudi Arabia)
 */
export const isValidPhone = (phone: string): boolean => {
    const re = /^(?:\+966|0)?5\d{8}$/;
    return re.test(phone.replace(/[\s-]/g, ''));
};

/**
 * Truncate text
 */
export const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default {
    handleButtonClick,
    smoothScrollTo,
    copyToClipboard,
    debounce,
    throttle,
    formatNumber,
    formatDateArabic,
    formatTimeArabic,
    getRelativeTime,
    isValidEmail,
    isValidPhone,
    truncateText,
    generateId,
};
