/**
 * i18n Context
 * Language management and translation system
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import ar from './translations/ar.json';
import en from './translations/en.json';

// Types
type Language = 'ar' | 'en';
type TranslationKey = string;

interface i18nContextType {
    language: Language;
    t: (key: TranslationKey) => string;
    changeLanguage: (lang: Language) => void;
}

const translations = { ar, en };

// Context
const i18nContext = createContext<i18nContextType | undefined>(undefined);
/**
 * i18n Provider Component
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // ✅ CRITICAL: Safe localStorage access with try-catch and null check
    const [language, setLanguage] = useState<'ar' | 'en'>(() => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const stored = localStorage.getItem('adora_language');
                if (stored === 'en' || stored === 'ar') {
                    return stored;
                }
            }
        } catch (e) {
            // localStorage not available (SSR, private mode, etc.)
            console.warn('localStorage not available, defaulting to Arabic:', e);
        }
        return 'ar'; // Default to Arabic
    });

    const changeLanguage = useCallback((newLang: 'ar' | 'en') => {
        setLanguage(newLang);
        
        // ✅ CRITICAL: Safe localStorage access
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem('adora_language', newLang);
            }
        } catch (e) {
            console.warn('Could not save language to localStorage:', e);
        }

        // Update document direction and lang attribute
        if (typeof document !== 'undefined') {
            document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = newLang;
        }
    }, []);

    // Set initial direction on mount
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = language;
        }
    }, [language]);

    // Translation function
    const t = (key: TranslationKey): string => {
        const keys = key.split('.');
        let value: any = translations[language];

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                // Fallback to Arabic if key not found
                value = translations['ar'];
                for (const fallbackKey of keys) {
                    if (value && typeof value === 'object') {
                        value = value[fallbackKey];
                    } else {
                        return key; // Return key if not found
                    }
                }
                break;
            }
        }

        return typeof value === 'string' ? value : key;
    };

    // ✅ Duplicate effect removed - already handled above

    return (
        <i18nContext.Provider value={{ language, t, changeLanguage }}>
            {children}
        </i18nContext.Provider>
    );
};

// Hook (DEPRECATED - Not used anywhere, kept for backward compatibility)
// If you see "usei18n must be used within i18nProvider" error, use useTranslation from react-i18next instead
export const usei18n = (): i18nContextType => {
    const context = useContext(i18nContext);
    if (!context) {
        // ✅ CRITICAL: This error means usei18n is being called outside I18nProvider
        // Check that I18nProvider wraps your component tree in main.tsx
        // Consider using useTranslation from react-i18next instead (recommended)
        throw new Error('usei18n must be used within i18nProvider. Use useTranslation from react-i18next instead.');
    }
    return context;
};

export default I18nProvider;
