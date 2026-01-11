/**
 * Professional Button Component
 * Modern button design with gradients and animations
 * Adora Hotel Management System V2
 */

import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';
import { haptic, playSound } from '../../utils/uxEffects';

interface ProfessionalButtonProps {
    children: React.ReactNode;
    onClick?: () => void | Promise<void>;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    loading?: boolean;
    disabled?: boolean;
    fullWidth?: boolean;
    gradient?: boolean;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
    withFeedback?: boolean;
}

export const ProfessionalButton: React.FC<ProfessionalButtonProps> = ({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    fullWidth = false,
    gradient = true,
    className = '',
    type = 'button',
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

    const variantClasses = {
        primary: gradient
            ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40'
            : 'bg-primary-600 text-white hover:bg-primary-500',
        secondary: 'bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 hover:border-white/30',
        ghost: 'bg-transparent text-white/60 hover:bg-white/10 hover:text-white',
        danger: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50',
        success: 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 hover:border-green-500/50',
    };

    const sizeClasses = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    };

    return (
        <button
            type={type}
            onClick={handleClick}
            disabled={isDisabled}
            className={`
                pro-btn pro-btn-${variant}
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                ${fullWidth ? 'w-full' : ''}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                rounded-xl font-semibold
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

export default ProfessionalButton;
