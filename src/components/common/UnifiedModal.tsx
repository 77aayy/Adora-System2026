/**
 * Unified Modal Component
 * Consistent modal design across the application
 * Adora Hotel Management System V2
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { haptic } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface UnifiedModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    size?: ModalSize;
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

// ============================================================
// SIZE CONFIG
// ============================================================

const SIZE_CLASSES: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const UnifiedModal: React.FC<UnifiedModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    size = 'md',
    showCloseButton = true,
    closeOnBackdrop = true,
    children,
    footer,
    className = '',
}) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle escape key - Keep scroll position visible
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                haptic('light');
                onClose();
            }
        };

        if (isOpen) {
            // Don't prevent body scroll - let modal appear in current viewport
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
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

    return (
        <div
            className="fixed inset-0 z-[100] flex items-start justify-center p-4"
            onClick={handleBackdropClick}
            style={{
                // ✅ Modal appears in current viewport position (top of viewport)
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                overflowY: 'auto',
                padding: '1rem',
                paddingTop: 'max(1rem, env(safe-area-inset-top))',
                // Scroll to top of viewport, not center
                scrollBehavior: 'auto'
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 animate-fade-in" style={{ backdropFilter: 'none', backgroundColor: 'var(--theme-bg-overlay)' }} />

            {/* Modal */}
            <div
                ref={modalRef}
                className={`
                    relative w-full ${SIZE_CLASSES[size]}
                    rounded-3xl shadow-2xl
                    animate-modal-in
                    ${className}
                `}
                style={{ 
                    background: 'var(--theme-bg-secondary)', 
                    border: '1px solid var(--theme-border-primary)',
                    marginTop: 'max(2rem, 5vh)',
                    maxHeight: 'calc(100vh - max(4rem, 10vh))'
                }}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--theme-border-primary)' }}>
                        <div className="flex items-center gap-3">
                            {icon && (
                                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                                    {icon}
                                </div>
                            )}
                            <div>
                                {title && (
                                    <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>{title}</h2>
                                )}
                                {subtitle && (
                                    <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{subtitle}</p>
                                )}
                            </div>
                        </div>
                        {showCloseButton && (
                            <button
                                onClick={() => {
                                    haptic('light');
                                    onClose();
                                }}
                                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                                style={{ 
                                    background: 'var(--theme-bg-tertiary)',
                                    color: 'var(--theme-text-secondary)'
                                }}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="p-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-5 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                        {footer}
                    </div>
                )}
            </div>

            {/* Styles */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modal-in {
                    from { 
                        opacity: 0; 
                        transform: scale(0.95) translateY(10px); 
                    }
                    to { 
                        opacity: 1; 
                        transform: scale(1) translateY(0); 
                    }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
                .animate-modal-in {
                    animation: modal-in 0.25s ease-out;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: var(--theme-scrollbar-bg);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--theme-scrollbar-thumb);
                    border-radius: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: var(--theme-scrollbar-thumb-hover);
                }
            `}</style>
        </div>
    );
};

// ============================================================
// MODAL BUTTON HELPERS
// ============================================================

export interface ModalButtonProps {
    variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    className?: string;
}

const BUTTON_VARIANTS = {
    primary: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:shadow-lg hover:shadow-primary-500/25',
    secondary: 'hover:opacity-90',
    success: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/25',
    danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:shadow-lg hover:shadow-red-500/25',
    warning: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:shadow-lg hover:shadow-yellow-500/25',
};

export const ModalButton: React.FC<ModalButtonProps> = ({
    variant = 'primary',
    children,
    onClick,
    disabled = false,
    loading = false,
    className = '',
}) => {
    const { t } = useTranslation();
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
                py-3 px-6 rounded-xl font-medium transition-all duration-200
                ${BUTTON_VARIANTS[variant]}
                ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}
                ${className}
            `}
            style={variant === 'secondary' ? {
                background: 'var(--theme-bg-tertiary)',
                color: 'var(--theme-text-primary)',
                border: '1px solid var(--theme-border-primary)'
            } : {}}
        >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('common.loading')}
                </span>
            ) : (
                children
            )}
        </button>
    );
};

// ============================================================
// MODAL FOOTER PRESETS
// ============================================================

export interface ModalActionsProps {
    onCancel?: () => void;
    onConfirm?: () => void;
    cancelText?: string;
    confirmText?: string;
    confirmVariant?: ModalButtonProps['variant'];
    loading?: boolean;
    disabled?: boolean;
}

export const ModalActions: React.FC<ModalActionsProps> = ({
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
            <ModalButton variant="secondary" onClick={onCancel} className="flex-1">
                {finalCancelText}
            </ModalButton>
        )}
        {onConfirm && (
            <ModalButton
                variant={confirmVariant}
                onClick={onConfirm}
                loading={loading}
                disabled={disabled}
                className="flex-1"
            >
                {finalConfirmText}
            </ModalButton>
        )}
    </div>
    );
};

export default UnifiedModal;
