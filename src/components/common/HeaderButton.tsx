import React from 'react';

interface HeaderButtonProps {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    variant?: 'default' | 'danger' | 'primary' | 'warning';
    className?: string;
    count?: number;
    showLabel?: boolean; // Show label text on desktop
}

export const HeaderButton: React.FC<HeaderButtonProps> = ({
    onClick,
    icon,
    label,
    variant = 'default',
    className = '',
    count,
    showLabel = false
}) => {
    // ✅ Theme-aware styles using CSS classes
    const getVariantStyles = (): React.CSSProperties => {
        switch (variant) {
            case 'danger':
                return {
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                };
            case 'primary':
                return {
                    background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
                    color: '#14b8a6',
                    border: '1px solid rgba(20, 184, 166, 0.3)',
                    boxShadow: '0 4px 6px -1px rgba(20, 184, 166, 0.1)'
                };
            case 'warning':
                return {
                    background: 'rgba(249, 115, 22, 0.1)',
                    color: '#f97316',
                    border: '1px solid rgba(249, 115, 22, 0.2)'
                };
            default:
                return {
                    background: 'var(--theme-bg-tertiary)',
                    color: 'var(--theme-text-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                };
        }
    };

    return (
        <div className="relative group">
            <button
                onClick={onClick}
                className={`${showLabel ? 'px-3 sm:px-4 gap-2' : 'w-9 h-9 sm:w-10 sm:h-10'} rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:scale-105 ${className}`}
                style={getVariantStyles()}
                aria-label={label}
            >
                {icon}
                {showLabel && (
                    <span className="text-xs sm:text-sm font-medium hidden lg:inline">
                        {label}
                    </span>
                )}
                {count !== undefined && count > 0 && (
                    <span 
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
                        style={{ border: '2px solid var(--theme-bg-primary)' }}
                    >
                        {count}
                    </span>
                )}
            </button>

            {/* Custom Tooltip - Theme Aware */}
            <div 
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 transform translate-y-1 group-hover:translate-y-0 duration-200"
                style={{
                    background: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-primary)',
                    border: '1px solid var(--theme-border-primary)',
                    boxShadow: 'var(--theme-shadow-lg)'
                }}
            >
                {label}
            </div>
        </div>
    );
};
