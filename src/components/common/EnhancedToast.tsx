/**
 * Enhanced Toast Notifications
 * Features: Loading states, Actions, Stacking
 * Adora Hotel Management System
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, Loader } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';

export interface ToastAction {
    label: string;
    onClick: () => void;
}

export interface ToastOptions {
    id?: string;
    type?: ToastType;
    message: string;
    duration?: number;
    action?: ToastAction;
    onClose?: () => void;
}

interface Toast extends ToastOptions {
    id: string;
    type: ToastType;
}

// Global toast state
let toastId = 0;
let toastSubscribers: Array<(toasts: Toast[]) => void> = [];
let toastQueue: Toast[] = [];

/**
 * Enhanced Toast Manager
 * Supports loading states, actions, and promise-based toasts
 */
export const toast = {
    /**
     * Show success toast
     */
    success: (message: string, options?: Partial<ToastOptions>): string => {
        return addToast({ message, type: 'success', duration: 3000, ...options });
    },

    /**
     * Show error toast
     */
    error: (message: string, options?: Partial<ToastOptions>): string => {
        return addToast({ message, type: 'error', duration: 4000, ...options });
    },

    /**
     * Show info toast
     */
    info: (message: string, options?: Partial<ToastOptions>): string => {
        return addToast({ message, type: 'info', duration: 3000, ...options });
    },

    /**
     * Show warning toast
     */
    warning: (message: string, options?: Partial<ToastOptions>): string => {
        return addToast({ message, type: 'warning', duration: 3500, ...options });
    },

    /**
     * Show loading toast (doesn't auto-dismiss)
     * 
     * @example
     * ```typescript
     * const toastId = toast.loading('جاري الحفظ...');
     * // ... do work ...
     * toast.success('تم الحفظ!', { id: toastId }); // Replace loading toast
     * ```
     */
    loading: (message: string, options?: Partial<ToastOptions>): string => {
        return addToast({ message, type: 'loading', duration: 0, ...options });
    },

    /**
     * Promise-based toast
     * Shows loading, then success or error based on promise result
     * 
     * @example
     * ```typescript
     * toast.promise(
     *   saveToFirebase(),
     *   {
     *     loading: 'جاري الحفظ...',
     *     success: 'تم الحفظ بنجاح!',
     *     error: 'فشل الحفظ'
     *   }
     * );
     * ```
     */
    promise: async <T,>(
        promise: Promise<T>,
        messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: Error) => string) }
    ): Promise<T> => {
        const id = toast.loading(messages.loading);
        
        try {
            const result = await promise;
            const successMsg = typeof messages.success === 'function' 
                ? messages.success(result) 
                : messages.success;
            toast.success(successMsg, { id });
            return result;
        } catch (error) {
            const errorMsg = typeof messages.error === 'function' 
                ? messages.error(error as Error) 
                : messages.error;
            toast.error(errorMsg, { id });
            throw error;
        }
    },

    /**
     * Dismiss a specific toast
     */
    dismiss: (id: string): void => {
        toastQueue = toastQueue.filter(t => t.id !== id);
        notifySubscribers();
    },

    /**
     * Dismiss all toasts
     */
    dismissAll: (): void => {
        toastQueue = [];
        notifySubscribers();
    },
};

function addToast(options: ToastOptions): string {
    const id = options.id || `toast-${++toastId}`;
    
    // If replacing existing toast
    if (options.id) {
        const existingIndex = toastQueue.findIndex(t => t.id === options.id);
        if (existingIndex !== -1) {
            toastQueue[existingIndex] = { ...options, id, type: options.type || 'info' };
            notifySubscribers();
            return id;
        }
    }
    
    const newToast: Toast = {
        ...options,
        id,
        type: options.type || 'info',
    };
    
    toastQueue.push(newToast);
    notifySubscribers();
    
    // Auto-dismiss after duration
    if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
            toast.dismiss(id);
        }, newToast.duration);
    }
    
    return id;
}

function notifySubscribers() {
    toastSubscribers.forEach(callback => callback([...toastQueue]));
}

/**
 * Toast Container Component
 * Place at root of your app
 */
export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    
    useEffect(() => {
        toastSubscribers.push(setToasts);
        return () => {
            toastSubscribers = toastSubscribers.filter(cb => cb !== setToasts);
        };
    }, []);
    
    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} />
            ))}
        </div>
    );
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast: t }) => {
    const [isExiting, setIsExiting] = useState(false);
    
    const handleClose = useCallback(() => {
        setIsExiting(true);
        setTimeout(() => {
            toast.dismiss(t.id);
            t.onClose?.();
        }, 200);
    }, [t.id, t.onClose]);
    
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-400" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
        warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
        loading: <Loader className="w-5 h-5 text-teal-400 animate-spin" />,
    };
    
    const colors = {
        success: 'bg-green-500/20 border-green-500/30',
        error: 'bg-red-500/20 border-red-500/30',
        info: 'bg-blue-500/20 border-blue-500/30',
        warning: 'bg-yellow-500/20 border-yellow-500/30',
        loading: 'bg-teal-500/20 border-teal-500/30',
    };
    
    return (
        <div
            className={`
                pointer-events-auto
                glass rounded-xl border ${colors[t.type]}
                px-4 py-3 min-w-[300px] max-w-md
                flex items-center gap-3
                shadow-lg
                transition-all duration-200
                ${isExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
                animate-in slide-in-from-top-2 fade-in
            `}
        >
            {/* Icon */}
            <div className="flex-shrink-0">
                {icons[t.type]}
            </div>
            
            {/* Message */}
            <div className="flex-1 text-sm text-white">
                {t.message}
            </div>
            
            {/* Action Button */}
            {t.action && (
                <button
                    onClick={() => {
                        t.action!.onClick();
                        handleClose();
                    }}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                >
                    {t.action.label}
                </button>
            )}
            
            {/* Close Button */}
            {t.type !== 'loading' && (
                <button
                    onClick={handleClose}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                    <X className="w-4 h-4 text-white/60" />
                </button>
            )}
        </div>
    );
};

export default toast;
