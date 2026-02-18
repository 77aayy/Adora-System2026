/**
 * Adora Custom Loading Spinner
 * Unique brand identity with animated "A" logo and meteor trail
 * ✅ Simplified version for better stability
 */

import React from 'react';

interface AdoraLoaderProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    message?: string;
    showMessage?: boolean;
}

export const AdoraLoader: React.FC<AdoraLoaderProps> = ({ 
    size = 'lg', 
    message = 'جاري تحميل البيانات...',
    showMessage = true 
}) => {
    const sizeConfig = {
        sm: { container: 'w-12 h-12', letter: 'text-lg', text: 'text-xs' },
        md: { container: 'w-16 h-16', letter: 'text-2xl', text: 'text-sm' },
        lg: { container: 'w-20 h-20', letter: 'text-3xl', text: 'text-base' },
        xl: { container: 'w-28 h-28', letter: 'text-5xl', text: 'text-lg' }
    };

    const config = sizeConfig[size];

    return (
        <div className="flex flex-col items-center justify-center gap-4">
            {/* Animated Logo Container */}
            <div className={`relative ${config.container}`}>
                {/* Outer rotating ring */}
                <div 
                    className="absolute inset-0 rounded-full border-4 border-teal-500/30 border-t-teal-400 animate-spin"
                />
                
                {/* Middle glow ring */}
                <div 
                    className="absolute inset-2 rounded-full border-2 border-teal-400/20 animate-pulse"
                />
                
                {/* Central "A" letter */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span 
                        className={`font-bold text-teal-400 ${config.letter} animate-pulse`}
                        style={{
                            textShadow: '0 0 20px rgba(20, 184, 166, 0.6), 0 0 40px rgba(20, 184, 166, 0.3)'
                        }}
                    >
                        A
                    </span>
                </div>
                
                {/* Sparkle dots */}
                <div className="absolute -top-1 left-1/2 w-2 h-2 bg-teal-400 rounded-full animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute top-1/2 -right-1 w-2 h-2 bg-teal-400 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                <div className="absolute -bottom-1 left-1/2 w-2 h-2 bg-teal-400 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.6s' }} />
                <div className="absolute top-1/2 -left-1 w-2 h-2 bg-teal-400 rounded-full animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.9s' }} />
            </div>
            
            {/* Loading message */}
            {showMessage && message && (
                <p className={`text-white/60 ${config.text} animate-pulse`}>
                    {message}
                </p>
            )}
        </div>
    );
};

/**
 * ✅ شاشة تحميل موحدة للبداية — بدلاً من null لتجنب الفلاش عند الـ refresh
 */
export const AppInitLoader: React.FC = () => (
    <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: 'var(--theme-bg-primary)' }}
    >
        <div className="flex flex-col items-center gap-4">
            <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '120ms' }} />
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '240ms' }} />
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500 animate-pulse">جاري التحميل...</p>
        </div>
    </div>
);

/**
 * Compact inline loader for buttons and small spaces
 * ✅ Simplified version using Tailwind animations
 */
export const AdoraLoaderInline: React.FC<{ size?: number }> = ({ size = 16 }) => {
    return (
        <div 
            className="relative inline-flex items-center justify-center"
            style={{ width: size, height: size }}
        >
            {/* Rotating ring */}
            <div 
                className="absolute inset-0 rounded-full border-2 border-teal-500/30 border-t-teal-400 animate-spin"
            />
            
            {/* Central A */}
            <span 
                className="text-teal-400 font-bold animate-pulse"
                style={{ fontSize: `${size * 0.5}px` }}
            >
                A
            </span>
        </div>
    );
};
