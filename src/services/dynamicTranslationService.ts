/**
 * Dynamic Translation Service
 * Auto-translates new content and syncs with Firebase
 * Uses multiple free translation APIs with fallback
 * Adora Hotel Management System V3 - SaaS
 */

import { db } from './firebase';
import { 
    doc, getDoc, setDoc, updateDoc, collection, 
    getDocs, query, where, Timestamp, serverTimestamp 
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type Language = 'ar' | 'en' | 'hi' | 'bn';

export interface TranslationEntry {
    key: string;
    ar: string;
    en: string | null;
    hi: string | null;
    bn: string | null;
    autoTranslated: boolean;
    verified: boolean;
    lastUpdated: Timestamp;
    source: 'manual' | 'mymemory' | 'lingva' | 'chatgpt' | 'google';
}

export interface TranslationConfig {
    autoTranslateEnabled: boolean;
    preferredProvider: 'mymemory' | 'lingva' | 'google' | 'chatgpt';
    syncInterval: number; // hours
    lastSync: Timestamp | null;
    totalTranslations: number;
    pendingTranslations: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const TRANSLATIONS_COLLECTION = 'translations';
const CONFIG_DOC = 'translationConfig';

// Language codes for different APIs
const LANG_CODES: Record<Language, { mymemory: string; lingva: string; google: string }> = {
    ar: { mymemory: 'ar', lingva: 'ar', google: 'ar' },
    en: { mymemory: 'en', lingva: 'en', google: 'en' },
    hi: { mymemory: 'hi', lingva: 'hi', google: 'hi' },
    bn: { mymemory: 'bn', lingva: 'bn', google: 'bn' },
};

// ============================================================
// FREE TRANSLATION APIs
// ============================================================

/**
 * 1. MyMemory API - FREE: 10,000 chars/day
 * https://mymemory.translated.net/doc/spec.php
 */
async function translateWithMyMemory(
    text: string,
    from: Language,
    to: Language
): Promise<string | null> {
    try {
        const fromCode = LANG_CODES[from].mymemory;
        const toCode = LANG_CODES[to].mymemory;
        
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromCode}|${toCode}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
            return data.responseData.translatedText;
        }
        
        return null;
    } catch (error) {
        logger.warn('MyMemory translation failed:', error, 'dynamicTranslationService');
        return null;
    }
}

/**
 * 2. Lingva Translate API - FREE (Google Translate mirror)
 * https://github.com/thedaviddelta/lingva-translate
 */
async function translateWithLingva(
    text: string,
    from: Language,
    to: Language
): Promise<string | null> {
    try {
        const fromCode = LANG_CODES[from].lingva;
        const toCode = LANG_CODES[to].lingva;
        
        // Public Lingva instances
        const instances = [
            'lingva.ml',
            'translate.plausibility.cloud',
            'lingva.lunar.icu',
        ];
        
        for (const instance of instances) {
            try {
                const url = `https://${instance}/api/v1/${fromCode}/${toCode}/${encodeURIComponent(text)}`;
                const response = await fetch(url, { 
                    headers: { 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(5000)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.translation) {
                        return data.translation;
                    }
                }
            } catch {
                continue; // Try next instance
            }
        }
        
        return null;
    } catch (error) {
        logger.warn('Lingva translation failed:', error, 'dynamicTranslationService');
        return null;
    }
}

/**
 * 3. LibreTranslate API - FREE (Self-hosted or public)
 * https://libretranslate.com/
 */
async function translateWithLibre(
    text: string,
    from: Language,
    to: Language
): Promise<string | null> {
    try {
        // Public LibreTranslate instances
        const instances = [
            'https://libretranslate.de/translate',
            'https://translate.argosopentech.com/translate',
        ];
        
        for (const url of instances) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        q: text,
                        source: from,
                        target: to,
                    }),
                    signal: AbortSignal.timeout(5000)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.translatedText) {
                        return data.translatedText;
                    }
                }
            } catch {
                continue;
            }
        }
        
        return null;
    } catch (error) {
        logger.warn('LibreTranslate failed:', error, 'dynamicTranslationService');
        return null;
    }
}

// ============================================================
// MAIN TRANSLATION FUNCTION
// ============================================================

/**
 * Translate text using multiple providers with fallback
 */
export async function translateText(
    text: string,
    from: Language,
    to: Language,
    preferredProvider?: 'mymemory' | 'lingva' | 'libre'
): Promise<{ translation: string | null; source: string }> {
    if (from === to) {
        return { translation: text, source: 'same' };
    }
    
    // Try preferred provider first
    const providers = [
        { name: 'mymemory', fn: translateWithMyMemory },
        { name: 'lingva', fn: translateWithLingva },
        { name: 'libre', fn: translateWithLibre },
    ];
    
    // Reorder based on preference
    if (preferredProvider) {
        const preferredIndex = providers.findIndex(p => p.name === preferredProvider);
        if (preferredIndex > 0) {
            const [preferred] = providers.splice(preferredIndex, 1);
            providers.unshift(preferred);
        }
    }
    
    // Try each provider
    for (const provider of providers) {
        const result = await provider.fn(text, from, to);
        if (result) {
            logger.info(`Translation successful via ${provider.name}`, { text: text.substring(0, 30) }, 'dynamicTranslationService');
            return { translation: result, source: provider.name };
        }
    }
    
    return { translation: null, source: 'failed' };
}

// ============================================================
// FIREBASE SYNC
// ============================================================

/**
 * Get translation config
 */
export async function getTranslationConfig(tenantId: string): Promise<TranslationConfig> {
    try {
        const configRef = doc(db, `tenants/${tenantId}/settings`, CONFIG_DOC);
        const configSnap = await getDoc(configRef);
        
        if (configSnap.exists()) {
            return configSnap.data() as TranslationConfig;
        }
        
        // Default config
        return {
            autoTranslateEnabled: true,
            preferredProvider: 'mymemory',
            syncInterval: 24, // hours
            lastSync: null,
            totalTranslations: 0,
            pendingTranslations: 0,
        };
    } catch (error) {
        logger.error('Error getting translation config:', error, 'dynamicTranslationService');
        return {
            autoTranslateEnabled: false,
            preferredProvider: 'mymemory',
            syncInterval: 24,
            lastSync: null,
            totalTranslations: 0,
            pendingTranslations: 0,
        };
    }
}

/**
 * Save translation to Firebase
 */
export async function saveTranslation(
    tenantId: string,
    key: string,
    translations: Partial<Record<Language, string>>,
    source: string = 'manual'
): Promise<void> {
    try {
        const docRef = doc(db, `tenants/${tenantId}/${TRANSLATIONS_COLLECTION}`, key);
        const existingSnap = await getDoc(docRef);
        
        if (existingSnap.exists()) {
            await updateDoc(docRef, {
                ...translations,
                lastUpdated: serverTimestamp(),
                source,
            });
        } else {
            await setDoc(docRef, {
                key,
                ar: translations.ar || null,
                en: translations.en || null,
                hi: translations.hi || null,
                bn: translations.bn || null,
                autoTranslated: source !== 'manual',
                verified: source === 'manual',
                lastUpdated: serverTimestamp(),
                source,
            });
        }
    } catch (error) {
        logger.error('Error saving translation:', error, 'dynamicTranslationService');
    }
}

/**
 * Get all translations from Firebase
 */
export async function getFirebaseTranslations(
    tenantId: string
): Promise<Record<string, TranslationEntry>> {
    try {
        const translationsRef = collection(db, `tenants/${tenantId}/${TRANSLATIONS_COLLECTION}`);
        const snapshot = await getDocs(translationsRef);
        
        const translations: Record<string, TranslationEntry> = {};
        snapshot.forEach(doc => {
            translations[doc.id] = doc.data() as TranslationEntry;
        });
        
        return translations;
    } catch (error) {
        logger.error('Error getting Firebase translations:', error, 'dynamicTranslationService');
        return {};
    }
}

/**
 * Get pending (unverified) translations
 */
export async function getPendingTranslations(
    tenantId: string
): Promise<TranslationEntry[]> {
    try {
        const translationsRef = collection(db, `tenants/${tenantId}/${TRANSLATIONS_COLLECTION}`);
        const q = query(translationsRef, where('verified', '==', false));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => doc.data() as TranslationEntry);
    } catch (error) {
        logger.error('Error getting pending translations:', error, 'dynamicTranslationService');
        return [];
    }
}

// ============================================================
// AUTO-TRANSLATION
// ============================================================

/**
 * Auto-translate a new Arabic text to all languages
 */
export async function autoTranslateNewText(
    tenantId: string,
    key: string,
    arabicText: string
): Promise<TranslationEntry> {
    const entry: TranslationEntry = {
        key,
        ar: arabicText,
        en: null,
        hi: null,
        bn: null,
        autoTranslated: true,
        verified: false,
        lastUpdated: Timestamp.now(),
        source: 'manual',
    };
    
    const config = await getTranslationConfig(tenantId);
    
    if (!config.autoTranslateEnabled) {
        await saveTranslation(tenantId, key, { ar: arabicText }, 'manual');
        return entry;
    }
    
    // Translate to all languages in parallel
    const [enResult, hiResult, bnResult] = await Promise.all([
        translateText(arabicText, 'ar', 'en', config.preferredProvider as any),
        translateText(arabicText, 'ar', 'hi', config.preferredProvider as any),
        translateText(arabicText, 'ar', 'bn', config.preferredProvider as any),
    ]);
    
    entry.en = enResult.translation;
    entry.hi = hiResult.translation;
    entry.bn = bnResult.translation;
    entry.source = enResult.source as any;
    
    // Save to Firebase
    await saveTranslation(tenantId, key, {
        ar: arabicText,
        en: entry.en || undefined,
        hi: entry.hi || undefined,
        bn: entry.bn || undefined,
    }, entry.source);
    
    return entry;
}

/**
 * Batch translate multiple texts
 */
export async function batchTranslate(
    tenantId: string,
    texts: { key: string; ar: string }[],
    targetLanguage: Language
): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const translations = await Promise.all(
            batch.map(async ({ key, ar }) => {
                const result = await translateText(ar, 'ar', targetLanguage);
                return { key, translation: result.translation };
            })
        );
        
        translations.forEach(({ key, translation }) => {
            if (translation) {
                results.set(key, translation);
            }
        });
        
        // Delay between batches to respect rate limits
        if (i + batchSize < texts.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    return results;
}

// ============================================================
// SYNC & CACHING
// ============================================================

// Local cache
let translationCache: Record<string, Record<Language, string>> = {};
let lastCacheUpdate: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get translated text with caching
 */
export function t(key: string, language: Language): string {
    // Check cache first
    if (translationCache[key]?.[language]) {
        return translationCache[key][language];
    }
    
    // Fallback to key
    return key;
}

/**
 * Load translations into cache
 */
export async function loadTranslationsToCache(tenantId: string): Promise<void> {
    const now = Date.now();
    
    // Skip if cache is fresh
    if (now - lastCacheUpdate < CACHE_TTL) {
        return;
    }
    
    try {
        const firebaseTranslations = await getFirebaseTranslations(tenantId);
        
        translationCache = {};
        Object.entries(firebaseTranslations).forEach(([key, entry]) => {
            translationCache[key] = {
                ar: entry.ar || key,
                en: entry.en || key,
                hi: entry.hi || key,
                bn: entry.bn || key,
            };
        });
        
        lastCacheUpdate = now;
        logger.info(`Loaded ${Object.keys(translationCache).length} translations to cache`, null, 'dynamicTranslationService');
    } catch (error) {
        logger.error('Error loading translations to cache:', error, 'dynamicTranslationService');
    }
}

/**
 * Clear translation cache
 */
export function clearTranslationCache(): void {
    translationCache = {};
    lastCacheUpdate = 0;
}

// ============================================================
// WEEKLY SYNC JOB
// ============================================================

/**
 * Run weekly translation sync
 * - Check for missing translations
 * - Auto-translate pending items
 * - Update config
 */
export async function runWeeklySync(tenantId: string): Promise<{
    translated: number;
    failed: number;
    total: number;
}> {
    const result = { translated: 0, failed: 0, total: 0 };
    
    try {
        const pending = await getPendingTranslations(tenantId);
        result.total = pending.length;
        
        for (const entry of pending) {
            if (!entry.ar) continue;
            
            const languages: Language[] = ['en', 'hi', 'bn'];
            let hasFailure = false;
            
            for (const lang of languages) {
                if (!entry[lang]) {
                    const { translation, source } = await translateText(entry.ar, 'ar', lang);
                    
                    if (translation) {
                        await saveTranslation(tenantId, entry.key, { [lang]: translation }, source);
                    } else {
                        hasFailure = true;
                    }
                }
            }
            
            if (hasFailure) {
                result.failed++;
            } else {
                result.translated++;
                // Mark as verified if all translations exist
                await updateDoc(
                    doc(db, `tenants/${tenantId}/${TRANSLATIONS_COLLECTION}`, entry.key),
                    { verified: true }
                );
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Update config
        await setDoc(doc(db, `tenants/${tenantId}/settings`, CONFIG_DOC), {
            lastSync: serverTimestamp(),
            totalTranslations: result.translated + result.failed,
            pendingTranslations: result.failed,
        }, { merge: true });
        
        logger.info(`Weekly sync completed: ${result.translated} translated, ${result.failed} failed`, null, 'dynamicTranslationService');
    } catch (error) {
        logger.error('Weekly sync failed:', error, 'dynamicTranslationService');
    }
    
    return result;
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    translateText,
    autoTranslateNewText,
    batchTranslate,
    getTranslationConfig,
    saveTranslation,
    getFirebaseTranslations,
    getPendingTranslations,
    loadTranslationsToCache,
    clearTranslationCache,
    runWeeklySync,
    t,
};
