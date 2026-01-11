/**
 * Dynamic Translation Hook
 * Provides auto-translation capabilities with real-time sync
 * Adora Hotel Management System V3 - SaaS
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import {
    translateText,
    autoTranslateNewText,
    loadTranslationsToCache,
    getFirebaseTranslations,
    saveTranslation,
    runWeeklySync,
    Language,
    TranslationEntry,
} from '../services/dynamicTranslationService';

// ============================================================
// TYPES
// ============================================================

interface DynamicTranslationHook {
    // Current language
    language: Language;
    
    // Translation function (uses i18next + dynamic)
    t: (key: string, defaultText?: string) => string;
    
    // Auto-translate new Arabic text
    translateNew: (key: string, arabicText: string) => Promise<TranslationEntry>;
    
    // Get translation for specific language
    getTranslation: (key: string, targetLang: Language) => Promise<string | null>;
    
    // Batch operations
    translateBatch: (items: { key: string; ar: string }[]) => Promise<void>;
    
    // Sync operations
    syncTranslations: () => Promise<void>;
    runSync: () => Promise<{ translated: number; failed: number }>;
    
    // State
    isLoading: boolean;
    lastSync: Date | null;
    pendingCount: number;
}

// ============================================================
// HOOK
// ============================================================

export function useDynamicTranslation(): DynamicTranslationHook {
    const { t: i18nT, i18n } = useTranslation();
    const { tenantId } = useAuth();
    
    const [isLoading, setIsLoading] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [dynamicTranslations, setDynamicTranslations] = useState<Record<string, TranslationEntry>>({});
    
    const language = (i18n.language || 'ar') as Language;
    
    // Load dynamic translations on mount
    useEffect(() => {
        if (!tenantId) return;
        
        const load = async () => {
            setIsLoading(true);
            try {
                await loadTranslationsToCache(tenantId);
                const translations = await getFirebaseTranslations(tenantId);
                setDynamicTranslations(translations);
                
                // Count pending
                const pending = Object.values(translations).filter(t => !t.verified).length;
                setPendingCount(pending);
            } catch (error) {
                console.error('Error loading dynamic translations:', error);
            }
            setIsLoading(false);
        };
        
        load();
    }, [tenantId]);
    
    // Enhanced translation function
    const t = useCallback((key: string, defaultText?: string): string => {
        // First try i18next
        const i18nResult = i18nT(key);
        if (i18nResult !== key) {
            return i18nResult;
        }
        
        // Then try dynamic translations
        const dynamic = dynamicTranslations[key];
        if (dynamic?.[language]) {
            return dynamic[language]!;
        }
        
        // Return default or key
        return defaultText || key;
    }, [i18nT, language, dynamicTranslations]);
    
    // Translate new Arabic text
    const translateNew = useCallback(async (
        key: string,
        arabicText: string
    ): Promise<TranslationEntry> => {
        if (!tenantId) {
            throw new Error('No tenant ID');
        }
        
        setIsLoading(true);
        try {
            const entry = await autoTranslateNewText(tenantId, key, arabicText);
            
            // Update local state
            setDynamicTranslations(prev => ({
                ...prev,
                [key]: entry,
            }));
            
            if (!entry.verified) {
                setPendingCount(prev => prev + 1);
            }
            
            return entry;
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);
    
    // Get translation for specific language
    const getTranslation = useCallback(async (
        key: string,
        targetLang: Language
    ): Promise<string | null> => {
        // Check dynamic first
        const dynamic = dynamicTranslations[key];
        if (dynamic?.[targetLang]) {
            return dynamic[targetLang];
        }
        
        // Check if we have Arabic to translate from
        if (dynamic?.ar && targetLang !== 'ar') {
            const result = await translateText(dynamic.ar, 'ar', targetLang);
            
            if (result.translation && tenantId) {
                // Save the new translation
                await saveTranslation(tenantId, key, { [targetLang]: result.translation }, result.source);
                
                // Update local state
                setDynamicTranslations(prev => ({
                    ...prev,
                    [key]: {
                        ...prev[key],
                        [targetLang]: result.translation,
                    },
                }));
            }
            
            return result.translation;
        }
        
        return null;
    }, [dynamicTranslations, tenantId]);
    
    // Batch translate
    const translateBatch = useCallback(async (
        items: { key: string; ar: string }[]
    ): Promise<void> => {
        if (!tenantId) return;
        
        setIsLoading(true);
        try {
            for (const item of items) {
                await autoTranslateNewText(tenantId, item.key, item.ar);
                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Reload translations
            const translations = await getFirebaseTranslations(tenantId);
            setDynamicTranslations(translations);
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);
    
    // Sync translations
    const syncTranslations = useCallback(async (): Promise<void> => {
        if (!tenantId) return;
        
        setIsLoading(true);
        try {
            await loadTranslationsToCache(tenantId);
            const translations = await getFirebaseTranslations(tenantId);
            setDynamicTranslations(translations);
            setLastSync(new Date());
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);
    
    // Run weekly sync
    const runSync = useCallback(async (): Promise<{ translated: number; failed: number }> => {
        if (!tenantId) {
            return { translated: 0, failed: 0 };
        }
        
        setIsLoading(true);
        try {
            const result = await runWeeklySync(tenantId);
            
            // Reload translations
            const translations = await getFirebaseTranslations(tenantId);
            setDynamicTranslations(translations);
            
            const pending = Object.values(translations).filter(t => !t.verified).length;
            setPendingCount(pending);
            setLastSync(new Date());
            
            return result;
        } finally {
            setIsLoading(false);
        }
    }, [tenantId]);
    
    return {
        language,
        t,
        translateNew,
        getTranslation,
        translateBatch,
        syncTranslations,
        runSync,
        isLoading,
        lastSync,
        pendingCount,
    };
}

// ============================================================
// AUTO-TRANSLATE COMPONENT WRAPPER
// ============================================================

/**
 * Higher-order component that auto-translates Arabic text
 */
export function withAutoTranslation<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    textProps: string[] // Props that contain Arabic text to translate
): React.FC<P> {
    return function AutoTranslatedComponent(props: P) {
        const { t, language } = useDynamicTranslation();
        
        // Create translated props
        const translatedProps = useMemo(() => {
            const result = { ...props };
            
            for (const propName of textProps) {
                const value = (props as any)[propName];
                if (typeof value === 'string' && value) {
                    (result as any)[propName] = t(value, value);
                }
            }
            
            return result;
        }, [props, t]);
        
        return <WrappedComponent {...translatedProps} />;
    };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Check if text is Arabic
 */
export function isArabicText(text: string): boolean {
    const arabicRegex = /[\u0600-\u06FF]/;
    return arabicRegex.test(text);
}

/**
 * Generate translation key from Arabic text
 */
export function generateTranslationKey(arabicText: string): string {
    // Create a simple hash-like key
    const normalized = arabicText
        .trim()
        .toLowerCase()
        .replace(/[^\u0600-\u06FFa-z0-9]/g, '_')
        .substring(0, 50);
    
    return `auto_${normalized}_${Date.now().toString(36)}`;
}

export default useDynamicTranslation;
