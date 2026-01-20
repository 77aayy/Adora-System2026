import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface PremiumSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    icon?: React.ReactNode;
    className?: string;
    disabled?: boolean;
}

export const PremiumSelect: React.FC<PremiumSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'اختر...',
    label,
    icon,
    className = '',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && <label className="block text-sm mb-1" style={{ color: 'var(--theme-text-secondary)' }}>{label}</label>}

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border-2 ${isOpen ? 'shadow-[0_0_15px_rgba(20,184,166,0.2)]' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{
                    background: 'var(--theme-input-bg)',
                    borderColor: isOpen ? 'var(--theme-border-focus)' : 'var(--theme-input-border)',
                    color: 'var(--theme-text-primary)'
                }}
                onMouseEnter={(e) => {
                    if (!isOpen && !disabled) {
                        e.currentTarget.style.borderColor = 'var(--theme-border-hover)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isOpen && !disabled) {
                        e.currentTarget.style.borderColor = 'var(--theme-input-border)';
                    }
                }}
            >
                <div className="flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                    {icon && <span style={{ color: 'var(--theme-text-tertiary)' }}>{icon}</span>}
                    {selectedOption ? (
                        <div className="flex items-center gap-2">
                            {selectedOption.icon && <span style={{ color: 'var(--theme-text-secondary)' }}>{selectedOption.icon}</span>}
                            <span>{selectedOption.label}</span>
                        </div>
                    ) : (
                        <span style={{ color: 'var(--theme-input-placeholder)' }}>{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--theme-text-tertiary)' }} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div 
                    className="absolute z-50 w-full mt-2 p-1 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        background: 'var(--theme-bg-secondary)',
                        border: '1px solid var(--theme-border-primary)'
                    }}
                >
                    <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-0.5">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className="w-full flex items-center justify-between p-2.5 rounded-lg transition-colors group"
                                style={{
                                    background: value === option.value ? 'var(--theme-primary-100)' : 'transparent',
                                    color: value === option.value ? 'var(--theme-primary-600)' : 'var(--theme-text-primary)'
                                }}
                                onMouseEnter={(e) => {
                                    if (value !== option.value) {
                                        e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (value !== option.value) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    {option.icon}
                                    <span>{option.label}</span>
                                </div>
                                {value === option.value && (
                                    <Check className="w-4 h-4" style={{ color: 'var(--theme-primary-500)' }} />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
