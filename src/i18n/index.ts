/**
 * i18n Configuration
 * Adora Hotel Management System V2
 * Supports: Arabic, English, Hindi, Bengali
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import ar from './locales/ar.json';
import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';

// ============================================================
// CONFIGURATION
// ============================================================

const resources = {
    ar: { translation: ar },
    en: { translation: en },
    hi: { translation: hi },
    bn: { translation: bn },
};

// RTL languages
export const RTL_LANGUAGES = ['ar'];

// Language metadata
export const LANGUAGES = [
    { code: 'ar', name: 'العربية', nativeName: 'العربية', dir: 'rtl' },
    { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
    { code: 'hi', name: 'हिंदी', nativeName: 'हिंदी', dir: 'ltr' },
    { code: 'bn', name: 'বাংলা', nativeName: 'বাংলা', dir: 'ltr' },
];

// ============================================================
// INIT
// ============================================================

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'ar',
        defaultNS: 'translation',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        },
    });

// ============================================================
// UTILITIES
// ============================================================

/**
 * Check if current language is RTL
 */
export const isRTL = (): boolean => {
    return RTL_LANGUAGES.includes(i18n.language);
};

/**
 * Get current language direction
 */
export const getDirection = (): 'rtl' | 'ltr' => {
    return isRTL() ? 'rtl' : 'ltr';
};

/**
 * Change language and update document direction
 */
export const changeLanguage = async (lang: string): Promise<void> => {
    await i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
};

/**
 * Get current language
 */
export const getCurrentLanguage = (): string => {
    return i18n.language;
};

export default i18n;
