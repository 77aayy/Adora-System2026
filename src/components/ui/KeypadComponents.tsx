/**
 * Shared Keypad Components - Adora Hotel Management System
 * Used in: LoginScreen, GuestDashboard
 * Brand Identity: Teal/Turquoise (#14b8a6)
 */

import React from 'react';
import { Delete } from 'lucide-react';
import { AdoraLoaderInline } from '../common/AdoraLoader';

// ============================================================
// HAPTIC FEEDBACK UTILITY
// ============================================================
export const triggerHaptic = (type: 'light' | 'medium' | 'success' | 'error' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns: Record<string, number | number[]> = {
      light: 10,
      medium: 25,
      success: [10, 50, 10],
      error: [50, 30, 50]
    };
    navigator.vibrate(patterns[type]);
  }
};

// ============================================================
// ANIMATED PIN DOT COMPONENT
// Premium design with smooth animations
// ============================================================
export interface PinDotProps {
  /** Whether this dot is filled with a digit */
  filled: boolean;
  /** The actual digit value */
  value?: string;
  /** Whether to show the actual value or a dot */
  showValue?: boolean;
  /** Index for staggered animation delay */
  index: number;
  /** Dark mode flag */
  isDark?: boolean;
  /** Optional size variant */
  size?: 'default' | 'large';
}

export const PinDot: React.FC<PinDotProps> = ({ 
  filled, 
  value, 
  showValue, 
  index, 
  isDark = false,
  size = 'default'
}) => {
  const sizeClasses = size === 'large' 
    ? 'w-12 h-14 sm:w-14 sm:h-16' 
    : 'w-11 h-13 sm:w-12 sm:h-14';

  return (
    <div
      className={`
        ${sizeClasses} rounded-xl flex items-center justify-center
        transition-all duration-300 transform
        ${filled 
          ? 'bg-gradient-to-br from-teal-400 to-teal-600 scale-100 shadow-lg shadow-teal-500/30' 
          : isDark 
            ? 'bg-slate-700 border-2 border-slate-600 scale-95'
            : 'bg-white border-2 border-slate-300 scale-95 shadow-sm shadow-slate-200'
        }
      `}
      style={{
        animation: filled ? `popIn 0.25s ease-out ${index * 0.03}s both` : 'none',
      }}
    >
      {filled && (
        <span className={`text-xl font-bold ${showValue ? 'text-white' : 'text-white'}`}>
          {showValue ? value : '●'}
        </span>
      )}
    </div>
  );
};

// ============================================================
// KEYPAD BUTTON COMPONENT
// Consistent button design for numeric keypads
// ============================================================
export interface KeypadButtonProps {
  /** Button value - number, 'delete', or 'enter' */
  value: string | 'delete' | 'enter';
  /** Click handler */
  onClick: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Visual variant */
  variant?: 'default' | 'delete' | 'enter';
  /** Loading state for enter button */
  isLoading?: boolean;
  /** Dark mode flag */
  isDark?: boolean;
  /** Custom enter button text */
  enterText?: string;
  /** Custom content (overrides default) */
  children?: React.ReactNode;
}

export const KeypadButton: React.FC<KeypadButtonProps> = ({ 
  value, 
  onClick, 
  disabled, 
  variant = 'default', 
  isLoading, 
  isDark = false,
  enterText = 'دخول',
  children
}) => {
  const handleClick = () => {
    triggerHaptic(variant === 'enter' ? 'medium' : 'light');
    onClick();
  };

  const baseClasses = `
    h-14 sm:h-16 rounded-xl font-bold text-xl sm:text-2xl
    transition-all duration-200 transform active:scale-90
    flex items-center justify-center
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variantClasses = {
    default: isDark 
      ? `bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 hover:border-teal-400 hover:shadow-md`
      : `bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm shadow-slate-200 hover:border-teal-400 hover:shadow-md`,
    delete: isDark
      ? `bg-red-900/30 hover:bg-red-800/40 text-red-400 border border-red-800/50`
      : `bg-red-50 hover:bg-red-100 text-red-500 border border-red-300 shadow-sm`,
    enter: `bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-white shadow-lg shadow-teal-500/30 hover:shadow-xl`,
  };

  // If custom children provided, render them
  if (children) {
    return (
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses[variant]}`}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]}`}
    >
      {variant === 'delete' ? (
        <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
      ) : variant === 'enter' ? (
        isLoading ? <AdoraLoaderInline size={24} /> : enterText
      ) : (
        value
      )}
    </button>
  );
};

// ============================================================
// KEYPAD GRID COMPONENT
// Complete numeric keypad with proper layout
// ============================================================
export interface KeypadGridProps {
  /** Handler for number key press */
  onKeyPress: (key: string) => void;
  /** Handler for delete key */
  onDelete: () => void;
  /** Handler for enter/confirm key (optional) */
  onEnter?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state for enter button */
  isLoading?: boolean;
  /** Dark mode flag */
  isDark?: boolean;
  /** Enter button text */
  enterText?: string;
  /** Show enter button (default: true) */
  showEnterButton?: boolean;
  /** Custom last row (instead of delete-0-enter) */
  customLastRow?: React.ReactNode;
}

export const KeypadGrid: React.FC<KeypadGridProps> = ({
  onKeyPress,
  onDelete,
  onEnter,
  disabled,
  isLoading,
  isDark = false,
  enterText = 'دخول',
  showEnterButton = true,
  customLastRow
}) => {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" dir="ltr">
      {/* Numbers 1-9 */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
        <KeypadButton
          key={n}
          value={String(n)}
          onClick={() => onKeyPress(String(n))}
          disabled={disabled}
          isDark={isDark}
        />
      ))}

      {/* Last row: Delete - 0 - Enter (or custom) */}
      {customLastRow || (
        <>
          <KeypadButton
            value="delete"
            variant="delete"
            onClick={onDelete}
            disabled={disabled}
            isDark={isDark}
          />
          <KeypadButton
            value="0"
            onClick={() => onKeyPress('0')}
            disabled={disabled}
            isDark={isDark}
          />
          {showEnterButton && onEnter ? (
            <KeypadButton
              value="enter"
              variant="enter"
              onClick={onEnter}
              disabled={disabled}
              isLoading={isLoading}
              isDark={isDark}
              enterText={enterText}
            />
          ) : (
            <div className="h-14 sm:h-16" /> // Empty placeholder
          )}
        </>
      )}
    </div>
  );
};

// ============================================================
// CSS KEYFRAMES (to be included in global styles or inline)
// ============================================================
export const keypadAnimationStyles = `
  @keyframes popIn {
    0% { transform: scale(0.5); opacity: 0; }
    60% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }
`;

// ============================================================
// DYNAMIC GREETING UTILITY
// ============================================================
export interface DynamicGreeting {
  greeting: string;
  message: string;
  iconColor: string;
  emoji: string;
  period: 'morning' | 'noon' | 'evening' | 'night';
}

export const getDynamicGreeting = (): DynamicGreeting => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return {
      greeting: 'صباح الخير',
      message: 'ابدأ يومك بإنتاجية عالية',
      iconColor: 'text-amber-500',
      emoji: '☀️',
      period: 'morning'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: 'مساء النور',
      message: 'استمر في تحقيق النجاح',
      iconColor: 'text-yellow-500',
      emoji: '🌤️',
      period: 'noon'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: 'مساء الخير',
      message: 'نهاية يوم مميز',
      iconColor: 'text-orange-500',
      emoji: '🌅',
      period: 'evening'
    };
  } else {
    return {
      greeting: 'مساء النجوم',
      message: 'وقت للراحة أو إنهاء المهام',
      iconColor: 'text-indigo-400',
      emoji: '🌙',
      period: 'night'
    };
  }
};

export default {
  PinDot,
  KeypadButton,
  KeypadGrid,
  triggerHaptic,
  getDynamicGreeting,
  keypadAnimationStyles
};
