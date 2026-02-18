/**
 * Language Detection Service
 * Auto-detect spoken language for multi-language support
 * Supports: Arabic, English, Hindi, Bengali
 * Adora Hotel Management System V2
 */

import { logger } from './loggerService';

// Supported languages with their STT codes
export const SUPPORTED_LANGUAGES = {
    arabic: {
        code: 'ar-EG',
        name: 'العربية',
        nameEn: 'Arabic',
        ttsVoice: 'ar-XA-Wavenet-D', // Google TTS voice
        patterns: /[\u0600-\u06FF]/g // Arabic script range
    },
    english: {
        code: 'en-US',
        name: 'English',
        nameEn: 'English',
        ttsVoice: 'en-US-Wavenet-D',
        patterns: /[a-zA-Z]/g
    },
    hindi: {
        code: 'hi-IN',
        name: 'हिन्दी',
        nameEn: 'Hindi',
        ttsVoice: 'hi-IN-Wavenet-D',
        patterns: /[\u0900-\u097F]/g // Devanagari script range
    },
    bengali: {
        code: 'bn-IN',
        name: 'বাংলা',
        nameEn: 'Bengali',
        ttsVoice: 'bn-IN-Wavenet-A',
        patterns: /[\u0980-\u09FF]/g // Bengali script range
    }
} as const;

export type LanguageKey = keyof typeof SUPPORTED_LANGUAGES;

/**
 * Detect language from text based on script analysis
 */
export const detectLanguage = (text: string): LanguageKey => {
    if (!text || text.trim().length === 0) {
        return 'arabic'; // Default
    }

    const counts: Record<LanguageKey, number> = {
        arabic: 0,
        english: 0,
        hindi: 0,
        bengali: 0
    };

    // Count characters matching each language pattern
    for (const [lang, config] of Object.entries(SUPPORTED_LANGUAGES)) {
        const matches = text.match(config.patterns);
        counts[lang as LanguageKey] = matches ? matches.length : 0;
    }

    // Find language with most matches
    let maxLang: LanguageKey = 'arabic';
    let maxCount = 0;

    for (const [lang, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            maxLang = lang as LanguageKey;
        }
    }

    logger.info(`🌐 Language detected: ${maxLang} (${SUPPORTED_LANGUAGES[maxLang].nameEn})`, undefined, 'languageDetectionService');
    return maxLang;
};

/**
 * Get STT language code for detected language
 */
export const getSTTCode = (lang: LanguageKey): string => {
    return SUPPORTED_LANGUAGES[lang].code;
};

/**
 * Get TTS voice for detected language
 */
export const getTTSVoice = (lang: LanguageKey): string => {
    return SUPPORTED_LANGUAGES[lang].ttsVoice;
};

/**
 * Get native language name
 */
export const getLanguageName = (lang: LanguageKey): string => {
    return SUPPORTED_LANGUAGES[lang].name;
};

/**
 * Get all supported language options for UI
 */
export const getLanguageOptions = () => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([key, config]) => ({
        key: key as LanguageKey,
        code: config.code,
        name: config.name,
        nameEn: config.nameEn
    }));
};

/**
 * Romanized Hindi/Bengali detection (common worker speech)
 * e.g., "Main towel laaya" (Hindi), "Ami towel enechhi" (Bengali)
 */
const ROMANIZED_HINDI_PATTERNS = [
    /\b(main|mujhe|kya|hai|hain|ho|karo|karna|aur|ya|nahi|haan|achha|theek|kaisa|kaise|kitna|kitne)\b/gi,
    /\b(towel|room|clean|dirty|ready|check|sir|madam)\b.*\b(laaya|laya|diya|kiya|karo|karna|chahiye)\b/gi
];

const ROMANIZED_BENGALI_PATTERNS = [
    /\b(ami|amar|tumi|tomar|ki|keno|haan|na|achhe|ache|korbo|korchi|dao|din|eshechhe)\b/gi,
    /\b(towel|room|clean).*\b(enechhi|dichhi|korchi)\b/gi
];

/**
 * Detect romanized South Asian languages
 */
export const detectRomanizedLanguage = (text: string): LanguageKey | null => {
    const normalizedText = text.toLowerCase();

    // Check Hindi patterns
    for (const pattern of ROMANIZED_HINDI_PATTERNS) {
        if (pattern.test(normalizedText)) {
            logger.info('🌐 Romanized Hindi detected', undefined, 'languageDetectionService');
            return 'hindi';
        }
    }

    // Check Bengali patterns
    for (const pattern of ROMANIZED_BENGALI_PATTERNS) {
        if (pattern.test(normalizedText)) {
            logger.info('🌐 Romanized Bengali detected', undefined, 'languageDetectionService');
            return 'bengali';
        }
    }

    return null;
};

/**
 * Smart language detection (script + romanized)
 */
export const smartDetectLanguage = (text: string): LanguageKey => {
    // First try script-based detection
    const scriptLang = detectLanguage(text);

    // If mostly English characters, check for romanized Hindi/Bengali
    if (scriptLang === 'english') {
        const romanized = detectRomanizedLanguage(text);
        if (romanized) {
            return romanized;
        }
    }

    return scriptLang;
};
