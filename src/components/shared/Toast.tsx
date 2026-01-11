/**
 * Toast Notification Component
 * Beautiful notifications with auto-dismiss
 */

import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastItemProps {
    toast: Toast;
    onClose: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(toast.id);
        }, toast.duration || 3000);

        return () => clearTimeout(timer);
    }, [toast, onClose]);

    const configs = {
        success: {
            icon: <CheckCircle className="w-5 h-5" />,
            bgColor: 'bg-green-500/90',
            textColor: 'text-white'
        },
        error: {
            icon: <AlertCircle className="w-5 h-5" />,
            bgColor: 'bg-red-500/90',
            textColor: 'text-white'
        },
        warning: {
            icon: <AlertTriangle className="w-5 h-5" />,
            bgColor: 'bg-orange-500/90',
            textColor: 'text-white'
        },
        info: {
            icon: <Info className="w-5 h-5" />,
            bgColor: 'bg-blue-500/90',
            textColor: 'text-white'
        }
    };

    const config = configs[toast.type];

    return (
        <div className={`${config.bgColor} ${config.textColor} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md animate-slide-in-right`}>
            {config.icon}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
                onClick={() => onClose(toast.id)}
                className="hover:opacity-70 transition-opacity"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export const ToastContainer: React.FC<{ toasts: Toast[]; onClose: (id: string) => void }> = ({ toasts, onClose }) => {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onClose={onClose} />
            ))}
        </div>
    );
};
