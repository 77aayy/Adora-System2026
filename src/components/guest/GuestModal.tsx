/**
 * Unified Guest Modal Component
 * Solid background design (no glass/blur) per project requirements
 * Matching LoginScreen.tsx visual identity
 * Adora Hotel Management System V3
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { haptic } from '../../utils/uxEffects';
import { useTheme } from '../../context/ThemeContext';

// ============================================================
// TYPES
// ============================================================

export type GuestModalSize = 'sm' | 'md' | 'lg' | 'full';
export type GuestModalPosition = 'bottom' | 'center';

export interface GuestModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    size?: GuestModalSize;
    position?: GuestModalPosition;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

// ============================================================
// SIZE CONFIG
// ============================================================

const SIZE_CLASSES: Record<GuestModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full',
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const GuestModal: React.FC<GuestModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    size = 'md',
    position = 'bottom',
    showCloseButton = true,
    closeOnBackdrop = true,
    children,
    footer,
    className = '',
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const { isDark } = useTheme();

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                haptic('light');
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
            haptic('light');
            onClose();
        }
    };

    if (!isOpen) return null;

    const isCenter = position === 'center';

    return (
        <div
            className={`
                fixed inset-0 z-[100] flex p-4
                ${isCenter ? 'items-center justify-center' : 'items-end justify-center'}
            `}
            onClick={handleBackdropClick}
        >
            {/* Backdrop - SOLID, NO BLUR per memory */}
            <div className="absolute inset-0 bg-black/60 animate-fade-in" />

            {/* Modal - SOLID BACKGROUND per memory */}
            <div
                ref={modalRef}
                className={`
                    relative w-full ${SIZE_CLASSES[size]}
                    shadow-2xl
                    ${isCenter 
                        ? 'rounded-3xl animate-modal-scale-in' 
                        : 'rounded-t-3xl sm:rounded-3xl animate-modal-slide-up'
                    }
                    ${isDark 
                        ? 'bg-slate-800 border border-slate-700' 
                        : 'bg-white border border-slate-200'
                    }
                    ${className}
                `}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className={`
                        flex items-center justify-between p-5
                        border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}
                    `}>
                        <div className="flex items-center gap-3">
                            {icon && (
                                <div className={`
                                    w-11 h-11 rounded-xl 
                                    bg-gradient-to-br from-teal-400 to-teal-600
                                    flex items-center justify-center
                                    shadow-lg shadow-teal-500/30
                                `}>
                                    {icon}
                                </div>
                            )}
                            <div>
                                {title && (
                                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        {title}
                                    </h2>
                                )}
                                {subtitle && (
                                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        </div>
                        {showCloseButton && (
                            <button
                                onClick={() => {
                                    haptic('light');
                                    onClose();
                                }}
                                className={`
                                    w-10 h-10 rounded-xl flex items-center justify-center
                                    transition-all duration-200
                                    ${isDark 
                                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white' 
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800'
                                    }
                                `}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="p-5 max-h-[70vh] overflow-y-auto guest-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className={`
                        p-5 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}
                    `}>
                        {footer}
                    </div>
                )}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modal-slide-up {
                    from { 
                        opacity: 0; 
                        transform: translateY(100%); 
                    }
                    to { 
                        opacity: 1; 
                        transform: translateY(0); 
                    }
                }
                @keyframes modal-scale-in {
                    from { 
                        opacity: 0; 
                        transform: scale(0.95); 
                    }
                    to { 
                        opacity: 1; 
                        transform: scale(1); 
                    }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
                .animate-modal-slide-up {
                    animation: modal-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .animate-modal-scale-in {
                    animation: modal-scale-in 0.25s ease-out;
                }
                .guest-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .guest-scrollbar::-webkit-scrollbar-track {
                    background: rgba(148, 163, 184, 0.1);
                    border-radius: 3px;
                }
                .guest-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(148, 163, 184, 0.3);
                    border-radius: 3px;
                }
                .guest-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(148, 163, 184, 0.5);
                }
            `}</style>
        </div>
    );
};

// ============================================================
// GUEST MODAL BUTTONS
// ============================================================

export interface GuestButtonProps {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'whatsapp';
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
    fullWidth?: boolean;
}

const BUTTON_STYLES: Record<string, { light: string; dark: string }> = {
    primary: {
        light: 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50',
        dark: 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50',
    },
    secondary: {
        light: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-2 border-slate-200',
        dark: 'bg-slate-700 text-slate-200 hover:bg-slate-600 border-2 border-slate-600',
    },
    success: {
        light: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30',
        dark: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30',
    },
    danger: {
        light: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30',
        dark: 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30',
    },
    whatsapp: {
        light: 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-600/30',
        dark: 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg shadow-green-600/30',
    },
};

export const GuestButton: React.FC<GuestButtonProps> = ({
    variant = 'primary',
    children,
    onClick,
    disabled = false,
    loading = false,
    className = '',
    fullWidth = false,
}) => {
    const { isDark } = useTheme();
    const styles = BUTTON_STYLES[variant];

    const handleClick = () => {
        if (!disabled && !loading) {
            haptic('light');
            onClick?.();
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled || loading}
            className={`
                py-3.5 px-6 rounded-xl font-semibold text-base
                transition-all duration-200 transform
                flex items-center justify-center gap-2
                ${fullWidth ? 'w-full' : ''}
                ${isDark ? styles.dark : styles.light}
                ${disabled || loading 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:-translate-y-0.5 active:translate-y-0 active:scale-98'
                }
                ${className}
            `}
        >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري...
                </span>
            ) : (
                children
            )}
        </button>
    );
};

// ============================================================
// GUEST MODAL ACTIONS (Footer)
// ============================================================

export interface GuestModalActionsProps {
    onCancel?: () => void;
    onConfirm?: () => void;
    cancelText?: string;
    confirmText?: string;
    confirmVariant?: GuestButtonProps['variant'];
    loading?: boolean;
    disabled?: boolean;
}

export const GuestModalActions: React.FC<GuestModalActionsProps> = ({
    onCancel,
    onConfirm,
    cancelText,
    confirmText,
    confirmVariant = 'primary',
    loading = false,
    disabled = false,
}) => {
    const { t } = useTranslation();
    const finalCancelText = cancelText || t('common.cancel');
    const finalConfirmText = confirmText || t('common.confirm');
    return (
    <div className="flex gap-3">
        {onCancel && (
            <GuestButton variant="secondary" onClick={onCancel} fullWidth>
                {finalCancelText}
            </GuestButton>
        )}
        {onConfirm && (
            <GuestButton
                variant={confirmVariant}
                onClick={onConfirm}
                loading={loading}
                disabled={disabled}
                fullWidth
            >
                {finalConfirmText}
            </GuestButton>
        )}
    </div>
    );
};

// ============================================================
// SUCCESS STATE COMPONENT
// ============================================================

export interface GuestSuccessStateProps {
    icon?: React.ReactNode;
    title: string;
    message?: string;
    iconColor?: string;
}

export const GuestSuccessState: React.FC<GuestSuccessStateProps> = ({
    icon,
    title,
    message,
    iconColor = 'text-green-400',
}) => {
    const { isDark } = useTheme();

    return (
        <div className="text-center py-8">
            <div className={`
                w-20 h-20 rounded-full 
                ${isDark ? 'bg-green-500/20' : 'bg-green-100'}
                flex items-center justify-center mx-auto mb-4 
                animate-pulse
            `}>
                {icon || (
                    <svg className={`w-10 h-10 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {title}
            </h3>
            {message && (
                <p className={`${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default GuestModal;
