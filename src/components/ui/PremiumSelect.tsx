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
            {label && <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">{label}</label>}

            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border-2 ${isOpen
                        ? 'bg-slate-50 dark:bg-slate-700 border-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.2)]'
                        : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                    {icon && <span className="text-slate-500 dark:text-white/50">{icon}</span>}
                    {selectedOption ? (
                        <div className="flex items-center gap-2">
                            {selectedOption.icon && <span className="text-slate-600 dark:text-white/70">{selectedOption.icon}</span>}
                            <span>{selectedOption.label}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400 dark:text-white/40">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-0.5">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleSelect(option.value)}
                                className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-colors group ${value === option.value
                                        ? 'bg-teal-500/20 text-teal-600 dark:text-white'
                                        : 'text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {option.icon}
                                    <span>{option.label}</span>
                                </div>
                                {value === option.value && (
                                    <Check className="w-4 h-4 text-teal-500" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
