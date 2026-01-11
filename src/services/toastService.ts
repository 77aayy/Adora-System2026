/**
 * Toast Notification Service
 * Migrated from toast-manager.js with TypeScript
 * Adora Hotel Management System V2
 * 
 * Beautiful toast notifications to replace alert()
 */

// ============================================================
// TYPES
// ============================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
    onClick?: () => void;
}

export interface ToastConfig {
    icon: string;
    color: string;
    defaultDuration: number;
}

// ============================================================
// CONSTANTS
// ============================================================

export const TOAST_CONFIG: Record<ToastType, ToastConfig> = {
    success: { icon: '✅', color: '#10B981', defaultDuration: 3000 },
    error: { icon: '❌', color: '#EF4444', defaultDuration: 4000 },
    warning: { icon: '⚠️', color: '#F59E0B', defaultDuration: 3500 },
    info: { icon: 'ℹ️', color: '#3B82F6', defaultDuration: 3000 },
    loading: { icon: '⏳', color: '#6366F1', defaultDuration: 10000 }
};

// ============================================================
// TOAST MANAGER
// ============================================================

class ToastManager {
    private container: HTMLElement | null = null;
    private toasts: Map<string, HTMLElement> = new Map();

    /**
     * Initialize container
     */
    private init(): void {
        if (typeof document === 'undefined') return;

        if (!document.getElementById('toastContainer')) {
            const container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
                max-width: 400px;
            `;
            document.body.appendChild(container);

            // Add styles
            this.addStyles();
        }

        this.container = document.getElementById('toastContainer');
    }

    /**
     * Add CSS styles
     */
    private addStyles(): void {
        if (document.getElementById('toast-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .toast {
                /* ✅ Theme-aware background using CSS variables */
                background: var(--theme-bg-secondary, #FFFFFF);
                border: 1px solid var(--theme-border-primary, #e2e8f0);
                border-radius: 1rem;
                padding: 1rem 1.25rem;
                box-shadow: var(--theme-shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.12));
                display: flex;
                align-items: center;
                gap: 0.75rem;
                pointer-events: auto;
                transform: translateX(120%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                border-right: 4px solid;
                direction: rtl;
                font-family: var(--font-family, 'Tajawal', sans-serif);
            }

            .toast-show {
                transform: translateX(0);
                opacity: 1;
            }

            .toast-hide {
                transform: translateX(120%);
                opacity: 0;
            }

            .toast-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
            }

            .toast-message {
                flex: 1;
                font-weight: 600;
                font-size: 0.9375rem;
                /* ✅ Theme-aware text color */
                color: var(--theme-text-primary, #1E293B);
                line-height: 1.5;
            }

            .toast-close {
                background: transparent;
                border: none;
                cursor: pointer;
                padding: 0.25rem;
                display: flex;
                align-items: center;
                justify-content: center;
                /* ✅ Theme-aware color */
                color: var(--theme-text-tertiary, #64748B);
                transition: color 0.2s;
                flex-shrink: 0;
                font-size: 1.125rem;
            }

            .toast-close:hover {
                color: var(--theme-text-primary, #1E293B);
            }

            .toast-success { border-right-color: #10B981; }
            .toast-error { border-right-color: #EF4444; }
            .toast-warning { border-right-color: #F59E0B; }
            .toast-info { border-right-color: #14b8a6; }
            .toast-loading { border-right-color: #6366F1; }

            @media (max-width: 768px) {
                #toastContainer {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
                .toast {
                    padding: 0.875rem 1rem;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Show a toast
     */
    show(message: string, type: ToastType = 'info', duration?: number): string {
        if (!this.container) this.init();
        if (!this.container) return '';

        const config = TOAST_CONFIG[type];
        const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const actualDuration = duration ?? config.defaultDuration;

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${config.icon}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" aria-label="إغلاق">×</button>
        `;

        // Add close handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn?.addEventListener('click', () => this.close(toastId));

        this.container.appendChild(toast);
        this.toasts.set(toastId, toast);

        // Show animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        // Auto close
        if (actualDuration > 0) {
            setTimeout(() => this.close(toastId), actualDuration);
        }

        // Haptic feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            if (type === 'success') navigator.vibrate(50);
            else if (type === 'error') navigator.vibrate([50, 50, 50]);
        }

        return toastId;
    }

    /**
     * Close a toast
     */
    close(toastId: string): void {
        const toast = this.toasts.get(toastId);
        if (!toast) return;

        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts.delete(toastId);
        }, 300);
    }

    /**
     * Close all toasts
     */
    closeAll(): void {
        this.toasts.forEach((_, id) => this.close(id));
    }

    /**
     * Success toast
     */
    success(message: string, duration?: number): string {
        return this.show(message, 'success', duration);
    }

    /**
     * Error toast
     */
    error(message: string, duration?: number): string {
        return this.show(message, 'error', duration);
    }

    /**
     * Warning toast
     */
    warning(message: string, duration?: number): string {
        return this.show(message, 'warning', duration);
    }

    /**
     * Info toast
     */
    info(message: string, duration?: number): string {
        return this.show(message, 'info', duration);
    }

    /**
     * Loading toast (stays until manually closed)
     */
    loading(message: string): string {
        return this.show(message, 'loading', 0);
    }

    /**
     * Promise toast - shows loading, then success/error
     */
    async promise<T>(
        promise: Promise<T>,
        messages: {
            loading: string;
            success: string | ((data: T) => string);
            error: string | ((err: any) => string);
        }
    ): Promise<T> {
        const loadingId = this.loading(messages.loading);

        try {
            const result = await promise;
            this.close(loadingId);
            const successMsg = typeof messages.success === 'function'
                ? messages.success(result)
                : messages.success;
            this.success(successMsg);
            return result;
        } catch (err) {
            this.close(loadingId);
            const errorMsg = typeof messages.error === 'function'
                ? messages.error(err)
                : messages.error;
            this.error(errorMsg);
            throw err;
        }
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const toast = new ToastManager();

// ============================================================
// REACT HOOK
// ============================================================

import { useCallback } from 'react';

interface UseToastReturn {
    show: (message: string, type?: ToastType, duration?: number) => string;
    success: (message: string) => string;
    error: (message: string) => string;
    warning: (message: string) => string;
    info: (message: string) => string;
    loading: (message: string) => string;
    close: (id: string) => void;
    closeAll: () => void;
}

export const useToast = (): UseToastReturn => {
    const show = useCallback((message: string, type?: ToastType, duration?: number) => {
        return toast.show(message, type, duration);
    }, []);

    const success = useCallback((message: string) => toast.success(message), []);
    const error = useCallback((message: string) => toast.error(message), []);
    const warning = useCallback((message: string) => toast.warning(message), []);
    const info = useCallback((message: string) => toast.info(message), []);
    const loading = useCallback((message: string) => toast.loading(message), []);
    const close = useCallback((id: string) => toast.close(id), []);
    const closeAll = useCallback(() => toast.closeAll(), []);

    return { show, success, error, warning, info, loading, close, closeAll };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    TOAST_CONFIG,
    toast,
    useToast
};
