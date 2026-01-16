/**
 * i18n Configuration
 * Internationalization setup for Arabic and English
 * Adora Hotel Management System V2
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ar from './locales/ar.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';

// Initialize i18n
// ✅ Safe initialization with error handling
try {
    i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
            resources: {
                en: { translation: en },
                ar: { translation: ar },
                hi: { translation: hi },
                bn: { translation: bn },
            },
            fallbackLng: 'ar', // Default to Arabic
            supportedLngs: ['ar', 'en', 'hi', 'bn'],

            detection: {
                order: ['localStorage', 'navigator'],
                caches: ['localStorage'],
                lookupLocalStorage: 'adora-language',
            },

            interpolation: {
                escapeValue: false, // React already escapes
            },

            react: {
                useSuspense: false,
            },
        })
        .catch((error) => {
            console.error('❌ i18n initialization error:', error);
            // Fallback: continue with default language
        });
} catch (error) {
    console.error('❌ i18n setup error:', error);
}

// RTL handler
export const updateDirection = (lang: string) => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    localStorage.setItem('adora-language', lang);
};

// Change language and update direction
export const changeLanguage = async (lang: string) => {
    await i18n.changeLanguage(lang);
    updateDirection(lang);
};

// Initialize direction on load
updateDirection(i18n.language || 'ar');

export default i18n;
