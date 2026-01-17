/**
 * Theme Toggle Component
 * Beautiful toggle switch for Light/Dark mode
 * 
 * Features:
 * - Animated sun/moon icons
 * - Smooth transition
 * - Accessible (keyboard support)
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

// ============================================================
// TYPES
// ============================================================

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

// ============================================================
// COMPONENT
// ============================================================

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 'md',
  showLabel = false,
}) => {
  const { theme, toggleTheme, isDark } = useTheme();

  // Size configurations
  const sizeConfig = {
    sm: {
      button: 'w-14 h-7',
      circle: 'w-5 h-5',
      translate: 'translate-x-7',
      icon: 'w-3 h-3',
      label: 'text-xs',
    },
    md: {
      button: 'w-16 h-8',
      circle: 'w-6 h-6',
      translate: 'translate-x-8',
      icon: 'w-4 h-4',
      label: 'text-sm',
    },
    lg: {
      button: 'w-20 h-10',
      circle: 'w-8 h-8',
      translate: 'translate-x-10',
      icon: 'w-5 h-5',
      label: 'text-base',
    },
  };

  const config = sizeConfig[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabel && (
        <span className={`${config.label} font-medium theme-text-secondary`}>
          {isDark ? 'الوضع الليلي' : 'الوضع النهاري'}
        </span>
      )}
      
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
        onClick={toggleTheme}
        className={`
          relative inline-flex items-center shrink-0
          ${config.button}
          rounded-full
          cursor-pointer
          transition-colors duration-300 ease-in-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          focus-visible:ring-teal-500
          ${isDark 
            ? 'bg-slate-700 hover:bg-slate-600' 
            : 'bg-slate-200 hover:bg-slate-300'
          }
        `}
      >
        {/* Background icons */}
        <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
          <Sun 
            className={`
              ${config.icon} 
              transition-opacity duration-300
              ${isDark ? 'opacity-30 text-yellow-400' : 'opacity-0'}
            `} 
          />
          <Moon 
            className={`
              ${config.icon} 
              transition-opacity duration-300
              ${isDark ? 'opacity-0' : 'opacity-30 text-slate-500'}
            `} 
          />
        </span>

        {/* Toggle circle */}
        <span
          className={`
            ${config.circle}
            inline-flex items-center justify-center
            rounded-full
            shadow-lg
            transform transition-all duration-300 ease-in-out
            ${isDark 
              ? `${config.translate} bg-slate-900` 
              : 'translate-x-1 bg-white'
            }
          `}
        >
          {isDark ? (
            <Moon className={`${config.icon} text-blue-400`} />
          ) : (
            <Sun className={`${config.icon} text-yellow-500`} />
          )}
        </span>
      </button>
    </div>
  );
};

// ============================================================
// SIMPLE ICON BUTTON VERSION
// ============================================================

export const ThemeToggleButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { toggleTheme, isDark } = useTheme();

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTheme();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-white/5 border border-transparent hover:border-white/10"
      style={{
        background: 'transparent',
        color: 'var(--theme-text-primary)',
        textAlign: 'right',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-blue-400" />
      )}
      <span className="flex-1 text-sm">
        {isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
      </span>
    </button>
  );
};

// ============================================================
// EXPORTS
// ============================================================

export default ThemeToggle;
