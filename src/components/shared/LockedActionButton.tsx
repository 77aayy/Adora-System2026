/**
 * 🔒 Locked Action Button Component
 * Unified button that respects workflow lock policy
 * 
 * Usage:
 * <LockedActionButton
 *   canAct={canTakeAction(card, 'housekeeping')}
 *   onClick={() => handleAction()}
 *   label="بدء التنظيف"
 *   icon={<Play className="w-4 h-4" />}
 *   variant="primary"
 * />
 */

import React from 'react';
import { Lock } from 'lucide-react';

interface LockedActionButtonProps {
    canAct: boolean;
    onClick: () => void;
    label: string;
    icon?: React.ReactNode;
    variant?: 'primary' | 'success' | 'danger' | 'warning' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    lockedMessage?: string;
    className?: string;
}

const VARIANT_STYLES = {
    primary: 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg shadow-teal-500/30',
    success: 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30',
    danger: 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30',
    warning: 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30',
    ghost: 'adora-btn-ghost',
};

const SIZE_STYLES = {
    sm: 'py-1.5 px-3 text-xs',
    md: 'py-2 px-4 text-sm',
    lg: 'py-3 px-6 text-base',
};

export const LockedActionButton: React.FC<LockedActionButtonProps> = ({
    canAct,
    onClick,
    label,
    icon,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    lockedMessage = 'مقفل - بانتظار قسم آخر',
    className = '',
}) => {
    if (!canAct) {
        // Locked state - show disabled button with lock icon
        return (
            <button
                disabled
                className={`
                    flex items-center justify-center gap-2 rounded-xl font-medium
                    ${SIZE_STYLES[size]}
                    ${fullWidth ? 'w-full' : ''}
                    bg-gray-200 dark:bg-gray-700/50 
                    text-gray-400 dark:text-gray-500
                    cursor-not-allowed
                    ${className}
                `}
                title={lockedMessage}
            >
                <Lock className="w-4 h-4" />
                <span className="opacity-70">{lockedMessage}</span>
            </button>
        );
    }

    // Active state - show action button
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center justify-center gap-2 rounded-xl font-medium
                transition-all duration-200 active:scale-95
                ${SIZE_STYLES[size]}
                ${VARIANT_STYLES[variant]}
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
};

/**
 * 🔒 Locked Card Overlay
 * Shows overlay when card is locked (not current holder)
 */
export const LockedCardOverlay: React.FC<{
    isLocked: boolean;
    lockedBy?: string;
    message?: string;
}> = ({ isLocked, lockedBy, message }) => {
    if (!isLocked) return null;

    const displayMessage = message || (lockedBy ? `بانتظار ${lockedBy}` : 'مقفل');

    return (
        <div className="adora-locked-overlay">
            <div className="adora-locked-badge">
                <Lock className="w-4 h-4" />
                <span>{displayMessage}</span>
            </div>
        </div>
    );
};

/**
 * Hook to get lock status for a card
 */
export function useLockStatus(card: any, currentDepartment: string): {
    isLocked: boolean;
    canAct: boolean;
    lockedBy: string | null;
} {
    const workflow = card?.workflow || {};
    const currentHolder = workflow.currentHolder || card?.currentDepartment;
    const isCompleted = workflow.workflowStatus === 'COMPLETED' || card?.status === 'COMPLETED';
    
    const canAct = currentHolder === currentDepartment && !isCompleted;
    const isLocked = !canAct && !isCompleted;
    const lockedBy = isLocked ? (currentHolder || null) : null;

    return { isLocked, canAct, lockedBy };
}

export default LockedActionButton;
