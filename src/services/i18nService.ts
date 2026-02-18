/**
 * i18n Service - Internationalization
 * Multi-language support for Adora Hotel System V2
 * Includes Genius Feature: Translation Guardian (Recursive Audit)
 */

import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';
import { generateAIContent } from './ai/geminiService';
import { logger } from './loggerService';

// Import Locales
import enLocale from '../i18n/locales/en.json';
import arLocale from '../i18n/locales/ar.json';
import hiLocale from '../i18n/locales/hi.json';
import bnLocale from '../i18n/locales/bn.json';

// ============================================================
// TYPES
// ============================================================

type Language = 'ar' | 'en' | 'hi' | 'bn';

interface Translations {
    [key: string]: any;
}

// ============================================================
// STATE
// ============================================================

let currentLanguage: Language = 'ar';
let translations: Record<Language, Translations> = {
    ar: {},
    en: {},
    hi: {},
    bn: {}
};

// ============================================================
// DEFAULT TRANSLATIONS
// ============================================================

const defaultTranslations: Record<Language, Translations> = {
    ar: arLocale,
    en: enLocale,
    hi: hiLocale,
    bn: bnLocale
};

// ============================================================
// 🧠 GENIUS FEATURE: Translation Guardian
// ============================================================

export interface TranslationAuditResult {
    missingKeys: number;
    details: string[];
}

/**
 * ⚡ Recursive logic to get all nested keys as flat paths (e.g. "common.save")
 */
const getDeepKeys = (obj: any, prefix = ''): string[] => {
    let keys: string[] = [];
    for (const key in obj) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys = keys.concat(getDeepKeys(obj[key], fullPath));
        } else {
            keys.push(fullPath);
        }
    }
    return keys;
};

/**
 * Get a value from a nested object using a path string
 */
const getValueByPath = (obj: any, path: string): any => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Audit all translations against the English master file
 */
export const auditTranslations = (): TranslationAuditResult => {
    const masterKeys = getDeepKeys(defaultTranslations.en);
    const issues: string[] = [];
    let totalMissing = 0;

    (['ar', 'hi', 'bn'] as Language[]).forEach(lang => {
        const targetKeys = getDeepKeys(defaultTranslations[lang]);
        const missing = masterKeys.filter(k => !targetKeys.includes(k));

        if (missing.length > 0) {
            totalMissing += missing.length;
            issues.push(`[${lang.toUpperCase()}] Missing ${missing.length} keys: ${missing.slice(0, 3).join(', ')}...`);
        }
    });

    return {
        missingKeys: totalMissing,
        details: issues
    };
};

/**
 * Use AI to generate missing translations for a specific language
 * 🧠 GENIUS FEATURE: Semantic Context Injection
 */
export const autoFixTranslations = async (lang: Language): Promise<string> => {
    const masterKeys = getDeepKeys(defaultTranslations.en);
    const targetKeys = getDeepKeys(defaultTranslations[lang]);
    const missing = masterKeys.filter(k => !targetKeys.includes(k));

    if (missing.length === 0) return 'All translations are up to date.';

    const SEMANTIC_MAP: Record<string, string> = {
        common: 'General User Interface / Common Actions',
        auth: 'Authentication & Security',
        departments: 'Hotel Department Names',
        requests: 'Guest Request Management',
        services: 'Hotel Services Categories',
        cleaning: 'Housekeeping & Room Cleaning Operations',
        maintenance: 'General Maintenance & Repairs',
        bellman: 'Bellman & Luggage Services',
        points: 'Loyalty Points / Gamification',
        dashboard: 'Management Dashboard Metrics',
        settings: 'System Configuration & Branch Settings',
        guest: 'Guest-facing Interaction Layer'
    };

    // Get English values for missing paths with semantic context
    const missingEntries = missing.slice(0, 15).map(k => {
        const val = getValueByPath(defaultTranslations.en, k);
        const prefix = k.split('.')[0];
        const context = SEMANTIC_MAP[prefix] || 'General System';
        return `[Context: ${context}] -> ${k}: "${val}"`;
    }).join('\n');

    const prompt = `
    ACT AS: Professional Tech Translator for "Adora Hotel Management System".
    TASK: Translate the following technical keys to ${lang === 'hi' ? 'HINDI' : lang === 'bn' ? 'BENGALI' : 'ARABIC'}.
    
    CRITICAL: Use the provided [Context] to ensure industry-specific accuracy (e.g., 'CLEAN' in a Housekeeping context vs a Tech context).
    
    KEYS (Full Path):
    ${missingEntries}

    OUTPUT FORMAT: Strictly JSON { "path.to.key": "Translated Value" }
    `;

    return await generateAIContent(prompt);
};

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Initialize i18n with default language
 */
export const initI18n = async (lang: Language = 'ar'): Promise<void> => {
    // Start with default JSONs
    translations = { ...defaultTranslations };

    // Merge custom overrides from Firebase if any
    try {
        const langs: Language[] = ['ar', 'en', 'hi', 'bn'];
        for (const l of langs) {
            const custom = await loadTranslationsFromFirebase(l);
            translations[l] = { ...translations[l], ...custom };
        }
    } catch (error) {
        logger.warn('Using default translations:', error, 'i18nService');
    }

    setLanguage(lang);
};

/**
 * Load custom translations from Firebase
 */
const loadTranslationsFromFirebase = async (lang: Language): Promise<Translations> => {
    try {
        const snapshot = await getDocs(collection(db, `translations/${lang}/strings`));
        const custom: Translations = {};
        snapshot.forEach(doc => {
            custom[doc.id] = doc.data().value;
        });
        return custom;
    } catch {
        return {};
    }
};

/**
 * Set current language
 */
export const setLanguage = (lang: Language): void => {
    currentLanguage = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('adora_lang', lang);

    // Update all elements with data-i18n attribute
    updateDOMTranslations();
};

/**
 * Get current language
 */
export const getLanguage = (): Language => {
    return currentLanguage;
};

/**
 * Toggle between languages
 */
export const toggleLanguage = (): Language => {
    const newLang: Language = (currentLanguage === 'ar' ? 'en' :
        currentLanguage === 'en' ? 'hi' :
            currentLanguage === 'hi' ? 'bn' : 'ar');
    setLanguage(newLang);
    return newLang;
};

/**
 * Translate a key (supports nested paths like "common.save")
 */
export const t = (key: string, params?: Record<string, string | number>): string => {
    // Try current language, fallback to Arabic, then return the key itself
    let text = getValueByPath(translations[currentLanguage], key) ||
        getValueByPath(translations['ar'], key) ||
        key;

    if (typeof text !== 'string') return key;

    // Replace parameters
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
        });
    }

    return text;
};

/**
 * Translate with fallback
 */
export const tf = (key: string, fallback: string): string => {
    const text = getValueByPath(translations[currentLanguage], key);
    return (text && typeof text === 'string') ? text : fallback;
};

/**
 * Get all translations for current language
 */
export const getTranslations = (): Translations => {
    return { ...translations[currentLanguage] };
};

/**
 * Check if key exists
 */
export const hasTranslation = (key: string): boolean => {
    return !!getValueByPath(translations[currentLanguage], key);
};

// ============================================================
// DOM FUNCTIONS
// ============================================================

/**
 * Update all DOM elements with data-i18n attribute
 */
export const updateDOMTranslations = (): void => {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            const htmlEl = el as HTMLElement;
            if (htmlEl.tagName === 'INPUT' || htmlEl.tagName === 'TEXTAREA') {
                (htmlEl as HTMLInputElement).placeholder = t(key);
            } else {
                htmlEl.textContent = t(key);
            }
        }
    });

    // Update title attributes
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) {
            (el as HTMLElement).title = t(key);
        }
    });
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format time ago in current language
 */
export const formatTimeAgo = (timestamp: any): string => {
    const date = timestamp instanceof Date ? timestamp : timestamp?.toDate?.() || new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000);

    // Using basic keys for time formatting
    if (diff < 1) return t('common.now') || 'الآن';

    // Simplistic fallback for time formatting keys
    const getUnit = (unit: string) => t(`common.${unit}`) || unit;

    if (diff < 60) {
        return currentLanguage === 'ar'
            ? `${getUnit('ago')} ${diff} ${getUnit('minutes')}`
            : `${diff} ${getUnit('minutes')} ${getUnit('ago')}`;
    }

    const hours = Math.floor(diff / 60);
    if (hours < 24) {
        return currentLanguage === 'ar'
            ? `${getUnit('ago')} ${hours} ${getUnit('hours')}`
            : `${hours} ${getUnit('hours')} ${getUnit('ago')}`;
    }

    const days = Math.floor(hours / 24);
    return currentLanguage === 'ar'
        ? `${getUnit('ago')} ${days} ${getUnit('days')}`
        : `${days} ${getUnit('days')} ${getUnit('ago')}`;
};

/**
 * Format number for current locale
 */
export const formatNumber = (num: number): string => {
    return num.toLocaleString(currentLanguage === 'ar' ? 'ar-SA' : 'en-US');
};

/**
 * Format currency for current locale
 */
export const formatCurrency = (amount: number): string => {
    return currentLanguage === 'ar'
        ? `${formatNumber(amount)} ر.س`
        : `SAR ${formatNumber(amount)}`;
};

/**
 * Get greeting based on time
 */
export const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return t('guest.good_morning') || 'Good Morning';
    if (hour < 17) return t('guest.good_afternoon') || 'Good Afternoon';
    return t('guest.good_evening') || 'Good Evening';
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const useTranslation = () => {
    const [lang, setLang] = useState<Language>(currentLanguage);

    useEffect(() => {
        const savedLang = localStorage.getItem('adora_lang') as Language;
        if (savedLang && ['ar', 'en', 'hi', 'bn'].includes(savedLang)) {
            setLanguage(savedLang);
            setLang(savedLang);
        }
    }, []);

    const changeLanguage = useCallback((newLang: Language) => {
        setLanguage(newLang);
        setLang(newLang);
    }, []);

    const toggle = useCallback(() => {
        const newLang = toggleLanguage();
        setLang(newLang);
    }, []);

    return {
        t,
        tf,
        lang,
        isRTL: lang === 'ar',
        changeLanguage,
        toggleLanguage: toggle,
        formatTimeAgo,
        formatNumber,
        formatCurrency,
        getGreeting
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    initI18n,
    setLanguage,
    getLanguage,
    toggleLanguage,
    t,
    tf,
    getTranslations,
    hasTranslation,
    updateDOMTranslations,
    formatTimeAgo,
    formatNumber,
    formatCurrency,
    getGreeting,
    useTranslation,
    auditTranslations,
    autoFixTranslations
};
