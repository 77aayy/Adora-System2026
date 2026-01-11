/**
 * Smart Search Hook
 * Fuzzy search with Arabic support
 * Adora Hotel Management System V2
 */

import { useState, useMemo, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface SearchOptions {
    keys: string[];
    threshold?: number;
    caseSensitive?: boolean;
}

// ============================================================
// ARABIC NORMALIZATION
// ============================================================

/**
 * Normalize Arabic text for better search matching
 */
const normalizeArabic = (text: string): string => {
    return text
        .replace(/[أإآا]/g, 'ا')  // Normalize alef
        .replace(/[ىي]/g, 'ي')   // Normalize ya
        .replace(/ة/g, 'ه')      // Normalize ta marbuta
        .replace(/[ًٌٍَُِّْ]/g, '') // Remove tashkeel
        .trim()
        .toLowerCase();
};

/**
 * Simple fuzzy match score
 */
const fuzzyMatch = (text: string, query: string): number => {
    const normalizedText = normalizeArabic(text);
    const normalizedQuery = normalizeArabic(query);

    // Exact match
    if (normalizedText === normalizedQuery) return 1;

    // Contains match
    if (normalizedText.includes(normalizedQuery)) {
        return 0.8 + (normalizedQuery.length / normalizedText.length) * 0.2;
    }

    // Starts with match
    if (normalizedText.startsWith(normalizedQuery)) return 0.9;

    // Character by character match
    let matches = 0;
    let lastIndex = -1;
    for (const char of normalizedQuery) {
        const index = normalizedText.indexOf(char, lastIndex + 1);
        if (index > lastIndex) {
            matches++;
            lastIndex = index;
        }
    }

    return matches / normalizedQuery.length * 0.5;
};

// ============================================================
// SEARCH FUNCTION
// ============================================================

/**
 * Search items with fuzzy matching
 */
export const searchItems = <T extends Record<string, any>>(
    items: T[],
    query: string,
    options: SearchOptions
): T[] => {
    if (!query.trim()) return items;

    const { keys, threshold = 0.3 } = options;

    const scored = items.map(item => {
        let maxScore = 0;

        for (const key of keys) {
            const value = getNestedValue(item, key);
            if (typeof value === 'string') {
                const score = fuzzyMatch(value, query);
                maxScore = Math.max(maxScore, score);
            }
        }

        return { item, score: maxScore };
    });

    return scored
        .filter(({ score }) => score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
};

/**
 * Get nested object value by path
 */
const getNestedValue = (obj: Record<string, any>, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
};

// ============================================================
// REACT HOOK
// ============================================================

/**
 * React hook for smart search
 */
export const useSmartSearch = <T extends Record<string, any>>(
    items: T[],
    keys: string[],
    debounceMs = 200
) => {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    // Debounce query
    const updateQuery = useCallback((newQuery: string) => {
        setQuery(newQuery);
        const timeoutId = setTimeout(() => {
            setDebouncedQuery(newQuery);
        }, debounceMs);
        return () => clearTimeout(timeoutId);
    }, [debounceMs]);

    // Filter items
    const filteredItems = useMemo(() => {
        if (!debouncedQuery.trim()) return items;
        return searchItems(items, debouncedQuery, { keys });
    }, [items, debouncedQuery, keys]);

    return {
        query,
        setQuery: updateQuery,
        filteredItems,
        isFiltering: query !== debouncedQuery,
    };
};

export default useSmartSearch;
