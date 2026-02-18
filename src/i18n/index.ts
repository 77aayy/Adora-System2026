/**
 * i18n Re-exports & metadata
 * Adora Hotel Management System V2
 * Does NOT init i18n - app uses src/i18n.ts with full src/locales/ resources.
 * This file only exports LANGUAGES and utils that use the main i18n instance.
 */

import i18n from '../i18n';

// RTL languages
export const RTL_LANGUAGES = ['ar'];

// Language metadata
export const LANGUAGES = [
    { code: 'ar', name: 'العربية', nativeName: 'العربية', dir: 'rtl' as const },
    { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' as const },
    { code: 'hi', name: 'हिंदी', nativeName: 'हिंदी', dir: 'ltr' as const },
    { code: 'bn', name: 'বাংলা', nativeName: 'বাংলা', dir: 'ltr' as const },
];

export const isRTL = (): boolean => RTL_LANGUAGES.includes(i18n.language);

export const getDirection = (): 'rtl' | 'ltr' => (isRTL() ? 'rtl' : 'ltr');

export const updateDirection = (lang: string): void => {
    const dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
};

export const changeLanguage = async (lang: string): Promise<void> => {
    await i18n.changeLanguage(lang);
    updateDirection(lang);
};

export const getCurrentLanguage = (): string => i18n.language;

export default i18n;
