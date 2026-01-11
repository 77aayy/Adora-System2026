/**
 * Adora Unified Loader
 * Beautiful, brand-consistent loading component
 * 
 * Features:
 * - Animated "A" logo
 * - Multiple sizes
 * - Theme-aware colors
 * - Optional loading text
 */

import React from 'react';

// ============================================================
// TYPES
// ============================================================

interface AdoraLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  fullScreen?: boolean;
  inline?: boolean;
  className?: string;
}

// ============================================================
// SIZE CONFIGURATIONS
// ============================================================

const sizeConfig = {
  xs: { container: 'w-6 h-6', text: 'text-xs', letter: 'text-sm' },
  sm: { container: 'w-8 h-8', text: 'text-xs', letter: 'text-base' },
  md: { container: 'w-12 h-12', text: 'text-sm', letter: 'text-xl' },
  lg: { container: 'w-16 h-16', text: 'text-base', letter: 'text-2xl' },
  xl: { container: 'w-24 h-24', text: 'text-lg', letter: 'text-4xl' },
};

// ============================================================
// COMPONENT
// ============================================================

export const AdoraLoaderUnified: React.FC<AdoraLoaderProps> = ({
  size = 'md',
  text,
  fullScreen = false,
  inline = false,
  className = '',
}) => {
  const config = sizeConfig[size];

  const loader = (
    <div className={`flex ${inline ? 'inline-flex' : 'flex-col'} items-center justify-center gap-3 ${className}`}>
      {/* Animated Logo Container */}
      <div className={`relative ${config.container}`}>
        {/* Outer spinning ring */}
        <div className="absolute inset-0 rounded-full border-2 border-teal-500/20 animate-spin-slow" />
        
        {/* Inner pulsing ring */}
        <div className="absolute inset-1 rounded-full border-2 border-t-teal-400 border-r-teal-400/50 border-b-transparent border-l-transparent animate-spin" />
        
        {/* Center "A" letter */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span 
            className={`font-bold ${config.letter} bg-gradient-to-br from-teal-400 to-teal-600 bg-clip-text text-transparent animate-pulse`}
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            A
          </span>
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-teal-400/10 blur-md animate-pulse" />
      </div>

      {/* Loading Text */}
      {text && (
        <span className={`${config.text} font-medium text-center`} style={{ color: 'var(--theme-text-secondary)' }}>
          {text}
        </span>
      )}
    </div>
  );

  // Full screen overlay
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--theme-bg-overlay)' }}>
        <div 
          className="p-8 rounded-2xl shadow-2xl"
          style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
        >
          {loader}
        </div>
      </div>
    );
  }

  return loader;
};

// ============================================================
// INLINE LOADER (For buttons, etc.)
// ============================================================

export const AdoraLoaderInline: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 16 }) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <span className="relative" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full border-2 border-teal-400/30 border-t-teal-400 animate-spin" />
    </span>
  </span>
);

// ============================================================
// SKELETON LOADER
// ============================================================

export const AdoraSkeleton: React.FC<{ 
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}> = ({ 
  className = '', 
  variant = 'rectangular',
  width,
  height 
}) => {
  const baseClass = 'animate-pulse';
  const variantClass = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={`${baseClass} ${variantClass[variant]} ${className}`}
      style={{
        width: width || '100%',
        height: height || (variant === 'text' ? '1em' : '100%'),
        background: 'var(--theme-bg-tertiary)',
      }}
    />
  );
};

// ============================================================
// LOADING DOTS
// ============================================================

export const LoadingDots: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
  </span>
);

// ============================================================
// ALIASES (for backward compatibility)
// ============================================================

/**
 * AdoraLoader - Alias for AdoraLoaderUnified with message prop support
 */
export const AdoraLoader: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullScreen?: boolean;
  inline?: boolean;
  className?: string;
}> = ({ message, ...props }) => (
  <AdoraLoaderUnified text={message} {...props} />
);

// ============================================================
// EXPORTS
// ============================================================

export default AdoraLoaderUnified;
