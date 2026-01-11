import React from 'react';
import { useUX } from '../../context/UXContext';

/**
 * Premium Switch Component
 * Consistent look across Adora Project
 */
interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    size?: 'sm' | 'md';
    disabled?: boolean;
    onColor?: string;
    offColor?: string;
}

export const Switch: React.FC<SwitchProps> = ({
    checked,
    onChange,
    size = 'md',
    disabled = false,
    onColor = 'bg-green-500',
    offColor = 'bg-white/10'
}) => {
    const { haptic } = useUX();

    const sizes = {
        sm: {
            container: 'w-10 h-5',
            dot: 'w-3.5 h-3.5',
            active: 'right-1',
            inactive: 'right-5.5' // Custom tailwind or use style
        },
        md: {
            container: 'w-12 h-6',
            dot: 'w-4 h-4',
            active: 'right-1',
            inactive: 'right-7'
        }
    };

    const s = sizes[size];

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!disabled) {
            haptic('light');
            onChange(!checked);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled}
            className={`
                relative ${s.container} rounded-full transition-all duration-300 
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}
                ${checked ? onColor : offColor}
                border border-white/5 shadow-inner
            `}
        >
            <div
                className={`
                    absolute top-1/2 -translate-y-1/2 ${s.dot} rounded-full bg-white shadow-xl transition-all duration-300
                    ${checked ? s.active : (size === 'sm' ? 'right-[22px]' : s.inactive)}
                `}
            />
        </button>
    );
};
