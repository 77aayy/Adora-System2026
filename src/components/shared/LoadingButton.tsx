/**
 * Loading Button Component
 * Enhanced button with loading state and animations
 * Adora Hotel Management System V2
 */

import React from 'react';
import { Loader2, LucideIcon } from 'lucide-react';
import { haptic, playSound } from '../../utils/uxEffects';

interface LoadingButtonProps {
    onClick?: () => void | Promise<void>;
    loading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    children: React.ReactNode;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    fullWidth?: boolean;
    withFeedback?: boolean;
}

const variantClasses = {
    primary: 'bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 hover:border-primary-500/50',
    secondary: 'bg-white/10 text-white/80 border border-white/20 hover:bg-white/20',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30',
    ghost: 'bg-transparent text-white/60 hover:bg-white/10 hover:text-white/80',
};

const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
};

export const LoadingButton: React.FC<LoadingButtonProps> = ({
    onClick,
    loading = false,
    disabled = false,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    children,
    className = '',
    type = 'button',
    fullWidth = false,
    withFeedback = true,
}) => {
    const handleClick = async () => {
        if (loading || disabled || !onClick) return;

        if (withFeedback) {
            haptic('light');
            playSound('click');
        }

        await onClick();
    };

    const isDisabled = loading || disabled;

    return (
        <button
            type={type}
            onClick={handleClick}
            disabled={isDisabled}
            className={`
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                ${fullWidth ? 'w-full' : ''}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                rounded-xl font-medium
                transition-all duration-200
                active:scale-95
                disabled:active:scale-100
                flex items-center justify-center gap-2
                relative overflow-hidden
                ${className}
            `}
        >
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="opacity-70">جاري التحميل...</span>
                </>
            ) : (
                <>
                    {Icon && iconPosition === 'left' && <Icon className="w-4 h-4" />}
                    {children}
                    {Icon && iconPosition === 'right' && <Icon className="w-4 h-4" />}
                </>
            )}
        </button>
    );
};

export default LoadingButton;
