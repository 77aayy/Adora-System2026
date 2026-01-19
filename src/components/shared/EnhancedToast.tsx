/**
 * Enhanced Toast Component
 * Improved toast notifications with better animations and UX
 * Adora Hotel Management System V2
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { haptic, playSound } from '../../utils/uxEffects';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title?: string;
    message: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface EnhancedToastProps {
    toast: Toast;
    onRemove: () => void;
}

export const EnhancedToast: React.FC<EnhancedToastProps> = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        // Haptic and sound feedback
        if (toast.type === 'success') {
            haptic('light');
            playSound('success');
        } else if (toast.type === 'error') {
            haptic('error');
            playSound('error');
        } else {
            haptic('light');
            playSound('notification');
        }

        // Auto-dismiss
        if (toast.duration !== undefined && toast.duration > 0) {
            const timer = setTimeout(() => {
                handleDismiss();
            }, toast.duration);

            return () => clearTimeout(timer);
        }
    }, [toast]);

    const handleDismiss = () => {
        setIsExiting(true);
        setTimeout(() => {
            onRemove();
        }, 300);
    };

    const iconMap = {
        success: <CheckCircle className="w-5 h-5 text-green-400" />,
        error: <XCircle className="w-5 h-5 text-red-400" />,
        warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
        info: <Info className="w-5 h-5 text-blue-400" />,
    };

    const bgMap = {
        success: 'bg-green-500/20',
        error: 'bg-red-500/20',
        warning: 'bg-yellow-500/20',
        info: 'bg-blue-500/20',
    };

    return (
        <div
            className={`
                pointer-events-auto
                flex items-start gap-3 p-4 rounded-2xl shadow-2xl toast
                ${bgMap[toast.type]}
                transition-all duration-300
                ${isExiting ? 'opacity-0 translate-x-full scale-95' : 'opacity-100 translate-x-0 scale-100'}
                animate-slide-in-right
                max-w-sm sm:max-w-md
            `}
            style={{ 
                border: 'none', 
                outline: 'none',
                background: 'var(--theme-bg-secondary, rgba(30, 41, 59, 0.95))'
            }}
            role="alert"
            aria-live="polite"
        >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">{iconMap[toast.type]}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <h4 className="text-white font-semibold text-sm mb-1">{toast.title}</h4>
                )}
                <p className="text-white/90 text-sm leading-relaxed">{toast.message}</p>
                {toast.action && (
                    <button
                        onClick={() => {
                            toast.action?.onClick();
                            handleDismiss();
                        }}
                        className="mt-2 text-xs font-medium text-primary-400 hover:text-primary-300 underline transition-colors"
                    >
                        {toast.action.label}
                    </button>
                )}
            </div>

            {/* Close Button */}
            <button
                onClick={handleDismiss}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all"
                aria-label="إغلاق"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

/**
 * Toast Container
 */
interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none max-w-md sm:max-w-lg mx-auto"
            role="region"
            aria-label="الإشعارات"
        >
            {toasts.map(toast => (
                <EnhancedToast
                    key={toast.id}
                    toast={toast}
                    onRemove={() => onRemove(toast.id)}
                />
            ))}
        </div>
    );
};

export default EnhancedToast;
