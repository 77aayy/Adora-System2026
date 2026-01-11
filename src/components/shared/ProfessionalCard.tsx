/**
 * Professional Card Component
 * Modern card design with glass effect and hover animations
 * Adora Hotel Management System V2
 */

import React from 'react';

interface ProfessionalCardProps {
    children: React.ReactNode;
    onClick?: () => void;
    hover?: boolean;
    gradient?: boolean;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export const ProfessionalCard: React.FC<ProfessionalCardProps> = ({
    children,
    onClick,
    hover = true,
    gradient = false,
    className = '',
    padding = 'lg',
}) => {
    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
    };

    return (
        <div
            className={`
                pro-card
                ${onClick ? 'cursor-pointer pro-card-interactive' : ''}
                ${gradient ? 'bg-gradient-to-br from-white/10 to-white/5' : ''}
                ${paddingClasses[padding]}
                ${hover ? 'hover:shadow-xl hover:border-primary-500/30' : ''}
                ${className}
            `}
            onClick={onClick}
        >
            {children}
        </div>
    );
};

export default ProfessionalCard;
