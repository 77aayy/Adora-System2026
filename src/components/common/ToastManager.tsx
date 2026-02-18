/**
 * Toast Manager
 * Global toast notifications (replacement for alert)
 * Adora Hotel Management System V2
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

// ============================================================
// CONTEXT
// ============================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

// ============================================================
// PROVIDER
// ============================================================

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        setToasts(prev => [...prev, { id, type, message, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

// ============================================================
// CONTAINER
// ============================================================

interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none max-w-md sm:max-w-lg mx-auto"
            role="region"
            aria-label="الإشعارات"
        >
            {toasts.map((toast, index) => (
                <div
                    key={toast.id}
                    className="stagger-children"
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    <ToastItem toast={toast} onRemove={() => onRemove(toast.id)} />
                </div>
            ))}
        </div>
    );
};

// ============================================================
// TOAST ITEM
// ============================================================

interface ToastItemProps {
    toast: Toast;
    onRemove: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (toast.duration !== undefined && toast.duration > 0) {
            const timer = setTimeout(() => {
                setIsExiting(true);
                setTimeout(() => onRemove(), 300);
            }, toast.duration);

            return () => clearTimeout(timer);
        }
    }, [toast, onRemove]);

    const iconMap = {
        success: <CheckCircle className="w-5 h-5 text-green-400" />,
        error: <XCircle className="w-5 h-5 text-red-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
    };

    // ✅ FIXED: Light/Dark mode compatible backgrounds
    const bgMap = {
        success: 'bg-white dark:bg-slate-800',
        error: 'bg-white dark:bg-slate-800',
        warning: 'bg-white dark:bg-slate-800',
        info: 'bg-white dark:bg-slate-800',
    };

    // ✅ Text colors that work in both light and dark mode
    const textColorMap = {
        success: 'text-green-600 dark:text-green-400',
        error: 'text-red-600 dark:text-red-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        info: 'text-blue-600 dark:text-blue-400',
    };

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(), 300);
    };

    return (
        <div
            className={`
                pointer-events-auto
                flex items-center gap-3 p-4 rounded-2xl toast
                ${bgMap[toast.type]}
                transition-all duration-300
                ${isExiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'}
                animate-slide-in-right
                max-w-sm sm:max-w-md
                shadow-lg dark:shadow-2xl
                border border-slate-200 dark:border-slate-700/50
            `}
            style={{ 
                outline: 'none'
            }}
            role="alert"
            aria-live="polite"
        >
            {iconMap[toast.type]}
            <p className={`flex-1 text-sm leading-relaxed ${textColorMap[toast.type]} font-medium`}>{toast.message}</p>
            <button
                onClick={handleDismiss}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
                aria-label="إغلاق"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

// ============================================================
// HELPER FUNCTIONS (for use outside React)
// ============================================================

let globalShowToast: ((type: ToastType, message: string, duration?: number) => void) | null = null;

export const setGlobalToast = (fn: typeof globalShowToast) => {
    globalShowToast = fn;
};

export const toast = {
    success: (message: string, duration?: number) => globalShowToast?.('success', message, duration),
    error: (message: string, duration?: number) => globalShowToast?.('error', message, duration),
    warning: (message: string, duration?: number) => globalShowToast?.('warning', message, duration),
    info: (message: string, duration?: number) => globalShowToast?.('info', message, duration),
};

export default ToastProvider;
