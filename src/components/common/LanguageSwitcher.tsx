/**
 * Language Switcher Component
 * Toggle between Arabic and English
 */

import React from 'react';
import { Globe } from 'lucide-react';
import { usei18n } from '../../i18n/i18nContext';

export const LanguageSwitcher: React.FC = () => {
    try {
        const context = usei18n();

        if (!context) {
            console.warn('i18n context not available');
            return null;
        }

        const { language, changeLanguage } = context;

        const toggleLanguage = () => {
            const newLang = language === 'ar' ? 'en' : 'ar';
            changeLanguage(newLang);
        };

        return (
            <button
                onClick={toggleLanguage}
                className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 transition-all" /* ✅ Improved contrast (was 70%) */
                title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
            >
                <div className="flex items-center gap-1">
                    <Globe className="w-5 h-5" />
                    <span className="text-xs font-bold">{language.toUpperCase()}</span>
                </div>
            </button>
        );
    } catch (error) {
        console.error('LanguageSwitcher error:', error);
        return null;
    }
};
