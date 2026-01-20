/**
 * Confirm Dialog
 * Custom confirmation modal (replacement for confirm)
 * Adora Hotel Management System V2
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ============================================================
// TYPES
// ============================================================

export type ConfirmType = 'confirm' | 'warning' | 'danger' | 'success';

export interface ConfirmOptions {
    type?: ConfirmType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
}

interface ConfirmContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ============================================================
// CONTEXT
// ============================================================

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const useConfirm = (): ConfirmContextValue => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within ConfirmProvider');
    }
    return context;
};

// ============================================================
// PROVIDER
// ============================================================

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dialog, setDialog] = useState<ConfirmOptions | null>(null);
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        setDialog(options);
        return new Promise((resolve) => {
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = async () => {
        if (dialog?.onConfirm) {
            await dialog.onConfirm();
        }
        resolver?.(true);
        setDialog(null);
        setResolver(null);
    };

    const handleCancel = () => {
        dialog?.onCancel?.();
        resolver?.(false);
        setDialog(null);
        setResolver(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {dialog && (
                <ConfirmDialog
                    {...dialog}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
        </ConfirmContext.Provider>
    );
};

// ============================================================
// DIALOG COMPONENT
// ============================================================

interface ConfirmDialogProps extends ConfirmOptions {
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    type = 'confirm',
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
}) => {
    const { t } = useTranslation();
    const finalConfirmText = confirmText || t('common.confirm');
    const finalCancelText = cancelText || t('common.cancel');
    const iconMap = {
        confirm: <HelpCircle className="w-8 h-8 text-blue-400" />,
        warning: <AlertTriangle className="w-8 h-8 text-yellow-400" />,
        danger: <XCircle className="w-8 h-8 text-red-400" />,
        success: <CheckCircle className="w-8 h-8 text-green-400" />,
    };

    const bgMap = {
        confirm: 'bg-blue-500/20',
        warning: 'bg-yellow-500/20',
        danger: 'bg-red-500/20',
        success: 'bg-green-500/20',
    };

    const buttonMap = {
        confirm: 'btn-primary',
        warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30',
        danger: 'btn-danger',
        success: 'btn-success',
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onCancel();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
        } else if (e.key === 'Enter' && e.ctrlKey) {
            onConfirm();
        }
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
        >
            <div className="absolute inset-0 bg-black/90 animate-fade-in" style={{ backdropFilter: 'none' }} />

            <div
                className="relative w-full max-w-sm sm:max-w-md rounded-3xl p-6 animate-scale-in shadow-2xl"
                style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl ${bgMap[type]} flex items-center justify-center mx-auto mb-4 animate-bounce-in`}>
                    {iconMap[type]}
                </div>

                {/* Title */}
                <h3 id="confirm-title" className="text-xl font-bold text-white text-center mb-2">
                    {title}
                </h3>

                {/* Message */}
                <p id="confirm-message" className="text-white/90 text-center mb-6 leading-relaxed"> {/* ✅ Improved contrast (was 70%) */}
                    {message}
                </p>

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 btn-secondary py-3 transition-all hover:scale-105 active:scale-95"
                        aria-label={finalCancelText}
                    >
                        {finalCancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 btn py-3 ${buttonMap[type]} transition-all hover:scale-105 active:scale-95`}
                        aria-label={finalConfirmText}
                    >
                        {finalConfirmText}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes scale-in {
                    0% { transform: scale(0.9) translateY(10px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                .animate-scale-in {
                    animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                @keyframes bounce-in {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}</style>
        </div>
    );
};

export default ConfirmProvider;
