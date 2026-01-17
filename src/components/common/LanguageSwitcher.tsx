/**
 * 🌍 Professional Language Switcher Component
 * Supports 4 languages: Arabic, English, Hindi (Colloquial), Bengali (Colloquial)
 * Zero-refresh language switching with automatic RTL/LTR direction
 * Adora Hotel Management System V3
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, updateDirection } from '../../i18n';

// Language configuration with native names
const LANGUAGES = [
    { code: 'ar', name: 'العربية', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिन्दी', nativeName: 'हिन्दी (आम)', flag: '🇮🇳' },
    { code: 'bn', name: 'বাংলা', nativeName: 'বাংলা (আম)', flag: '🇧🇩' },
] as const;

type LanguageCode = typeof LANGUAGES[number]['code'];

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const currentLang = LANGUAGES.find(lang => lang.code === i18n.language) || LANGUAGES[0];


    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Handle language change
    const handleLanguageChange = async (langCode: LanguageCode) => {
        try {
            await changeLanguage(langCode);
            updateDirection(langCode);
            setIsOpen(false);
            
            // Trigger haptic feedback if available
            if ('vibrate' in navigator) {
                navigator.vibrate(50);
            }
        } catch (error) {
            console.error('Error changing language:', error);
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Language Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium text-sm active:scale-95 w-full"
                aria-label="Change Language"
                aria-expanded={isOpen}
            >
                <Globe className="w-4 h-4" />
                <span className="hidden sm:inline">{currentLang.flag}</span>
                <span className="hidden md:inline text-xs">{currentLang.nativeName}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} mr-auto`} />
            </button>

            {/* Languages List - Inside parent menu, no absolute positioning */}
            {isOpen && (
                <div 
                    className="mt-2 rounded-lg border"
                    style={{ 
                        background: 'var(--theme-bg-secondary)',
                        borderColor: 'var(--theme-border-primary)',
                        overflow: 'hidden',
                    }}
                >
                    {LANGUAGES.map((lang, index) => {
                        const isActive = lang.code === i18n.language;
                        return (
                            <button
                                key={lang.code}
                                onClick={() => handleLanguageChange(lang.code)}
                                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors text-right"
                                style={{
                                    borderBottom: index < LANGUAGES.length - 1 ? '1px solid var(--theme-border-primary)' : 'none',
                                    background: isActive ? 'rgba(20, 184, 166, 0.12)' : 'transparent',
                                    color: isActive ? 'var(--theme-accent-teal)' : 'var(--theme-text-primary)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                            >
                                <span className="text-base">{lang.flag}</span>
                                <span className="flex-1">{lang.nativeName}</span>
                                {isActive && <Check className="w-4 h-4 text-teal-400" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
