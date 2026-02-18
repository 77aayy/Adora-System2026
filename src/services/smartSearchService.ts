/**
 * Smart Search Service
 * Migrated from smart-search.js with TypeScript
 * Adora Hotel Management System V2
 * 
 * Multi-layer search across:
 * - Rooms
 * - Requests
 * - Maintenance
 * - Employees
 * - History
 */

import { db } from './firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type SearchLayer = 'rooms' | 'requests' | 'maintenance' | 'employees' | 'history';

export interface SearchResult {
    id: string;
    title: string;
    subtitle: string;
    type: SearchLayer;
    metadata?: Record<string, any>;
}

export interface LayerResults {
    name: SearchLayer;
    icon: string;
    label: string;
    items: SearchResult[];
}

export interface SearchConfig {
    minChars: number;
    debounceMs: number;
    maxResultsPerLayer: number;
    layers: SearchLayer[];
}

export interface SessionContext {
    hotelId: string;
    branchId: string;
}

// ============================================================
// CONSTANTS
// ============================================================

export const DEFAULT_CONFIG: SearchConfig = {
    minChars: 1,
    debounceMs: 300,
    maxResultsPerLayer: 5,
    layers: ['rooms', 'requests', 'maintenance', 'employees', 'history']
};

export const LAYER_CONFIG: Record<SearchLayer, { icon: string; label: string }> = {
    rooms: { icon: '🏠', label: 'الغرف' },
    requests: { icon: '🛎️', label: 'الطلبات' },
    maintenance: { icon: '🔧', label: 'الصيانة' },
    employees: { icon: '👤', label: 'الموظفين' },
    history: { icon: '📋', label: 'السجل' }
};

// ============================================================
// SEARCH FUNCTIONS
// ============================================================

/**
 * Search rooms
 */
export const searchRooms = async (
    queryText: string,
    session: SessionContext,
    maxResults: number = 5
): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${session.hotelId}/branches/${session.branchId}/rooms`;

        const roomsQuery = query(
            collection(db, basePath),
            where('roomNumber', '>=', queryText),
            where('roomNumber', '<=', queryText + '\uf8ff'),
            limit(maxResults)
        );

        const snapshot = await getDocs(roomsQuery);

        snapshot.forEach(doc => {
            const data = doc.data();
            results.push({
                id: doc.id,
                title: `غرفة ${data.roomNumber}`,
                subtitle: translateRoomStatus(data.status),
                type: 'rooms',
                metadata: { roomNumber: data.roomNumber, status: data.status }
            });
        });
    } catch (error) {
        logger.warn('Room search error:', error, 'smartSearchService');
    }

    return results;
};

/**
 * Search requests
 */
export const searchRequests = async (
    queryText: string,
    session: SessionContext,
    maxResults: number = 5
): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${session.hotelId}/branches/${session.branchId}/requests`;

        // Search by room number
        const requestsQuery = query(
            collection(db, basePath),
            where('roomNumber', '>=', queryText),
            where('roomNumber', '<=', queryText + '\uf8ff'),
            limit(maxResults)
        );

        const snapshot = await getDocs(requestsQuery);

        snapshot.forEach(doc => {
            const data = doc.data();
            results.push({
                id: doc.id,
                title: `طلب غرفة ${data.roomNumber}`,
                subtitle: data.description?.substring(0, 40) || data.serviceType || 'بدون وصف',
                type: 'requests',
                metadata: { roomNumber: data.roomNumber, status: data.status }
            });
        });
    } catch (error) {
        logger.warn('Request search error:', error, 'smartSearchService');
    }

    return results;
};

/**
 * Search maintenance
 */
export const searchMaintenance = async (
    queryText: string,
    session: SessionContext,
    maxResults: number = 5
): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${session.hotelId}/branches/${session.branchId}/maintenance`;

        const maintQuery = query(
            collection(db, basePath),
            where('roomNumber', '>=', queryText),
            where('roomNumber', '<=', queryText + '\uf8ff'),
            limit(maxResults)
        );

        const snapshot = await getDocs(maintQuery);

        snapshot.forEach(doc => {
            const data = doc.data();
            results.push({
                id: doc.id,
                title: `صيانة غرفة ${data.roomNumber}`,
                subtitle: data.issueType || data.description?.substring(0, 40) || 'بدون وصف',
                type: 'maintenance',
                metadata: { roomNumber: data.roomNumber, status: data.status }
            });
        });
    } catch (error) {
        logger.warn('Maintenance search error:', error, 'smartSearchService');
    }

    return results;
};

/**
 * Search employees
 */
export const searchEmployees = async (
    queryText: string,
    session: SessionContext,
    maxResults: number = 5
): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${session.hotelId}/branches/${session.branchId}/employees`;

        const employeesQuery = query(
            collection(db, basePath),
            where('name', '>=', queryText),
            where('name', '<=', queryText + '\uf8ff'),
            limit(maxResults)
        );

        const snapshot = await getDocs(employeesQuery);

        snapshot.forEach(doc => {
            const data = doc.data();
            results.push({
                id: doc.id,
                title: data.name || data.employeeName,
                subtitle: translateDepartment(data.department) || 'موظف',
                type: 'employees',
                metadata: { department: data.department, code: data.code }
            });
        });
    } catch (error) {
        logger.warn('Employee search error:', error, 'smartSearchService');
    }

    return results;
};

/**
 * Search history (local storage)
 */
export const searchHistory = async (
    queryText: string,
    maxResults: number = 5
): Promise<SearchResult[]> => {
    const results: SearchResult[] = [];

    try {
        // Search in localStorage
        const logs = JSON.parse(localStorage.getItem('adora_cleaning_log') || '[]');

        const matches = logs.filter((log: any) => {
            const roomNum = String(log.roomNumber || log.room || '');
            return roomNum.includes(queryText);
        }).slice(0, maxResults);

        matches.forEach((log: any) => {
            const timestamp = log.timestamp || log.finishTime;
            results.push({
                id: log.id || String(timestamp),
                title: `سجل غرفة ${log.roomNumber || log.room}`,
                subtitle: new Date(timestamp).toLocaleDateString('ar-EG'),
                type: 'history',
                metadata: { timestamp }
            });
        });
    } catch (error) {
        logger.warn('History search error:', error, 'smartSearchService');
    }

    return results;
};

// ============================================================
// COMBINED SEARCH
// ============================================================

/**
 * Perform search across all layers
 */
export const performSearch = async (
    queryText: string,
    session: SessionContext,
    config: Partial<SearchConfig> = {}
): Promise<LayerResults[]> => {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const results: LayerResults[] = [];

    if (queryText.length < fullConfig.minChars) {
        return results;
    }

    const searchPromises = fullConfig.layers.map(async (layer) => {
        let items: SearchResult[] = [];

        switch (layer) {
            case 'rooms':
                items = await searchRooms(queryText, session, fullConfig.maxResultsPerLayer);
                break;
            case 'requests':
                items = await searchRequests(queryText, session, fullConfig.maxResultsPerLayer);
                break;
            case 'maintenance':
                items = await searchMaintenance(queryText, session, fullConfig.maxResultsPerLayer);
                break;
            case 'employees':
                items = await searchEmployees(queryText, session, fullConfig.maxResultsPerLayer);
                break;
            case 'history':
                items = await searchHistory(queryText, fullConfig.maxResultsPerLayer);
                break;
        }

        if (items.length > 0) {
            return {
                name: layer,
                icon: LAYER_CONFIG[layer].icon,
                label: LAYER_CONFIG[layer].label,
                items
            };
        }
        return null;
    });

    const layerResults = await Promise.all(searchPromises);

    layerResults.forEach(result => {
        if (result) {
            results.push(result);
        }
    });

    return results;
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Translate room status
 */
const translateRoomStatus = (status: string): string => {
    const statuses: Record<string, string> = {
        available: 'متاح',
        occupied: 'مشغول',
        cleaning: 'قيد التنظيف',
        maintenance: 'صيانة',
        checkout: 'مغادرة',
        reserved: 'محجوز'
    };
    return statuses[status?.toLowerCase()] || status || 'غير محدد';
};

/**
 * Translate department
 */
const translateDepartment = (dept: string): string => {
    const depts: Record<string, string> = {
        reception: 'الاستقبال',
        housekeeping: 'التدبير المنزلي',
        maintenance: 'الصيانة',
        bellman: 'البيلمان',
        manager: 'الإدارة'
    };
    return depts[dept?.toLowerCase()] || dept || 'موظف';
};

/**
 * Highlight matching text
 */
export const highlightMatch = (text: string, query: string): string => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useMemo } from 'react';

interface UseSmartSearchReturn {
    query: string;
    setQuery: (q: string) => void;
    results: LayerResults[];
    loading: boolean;
    hasResults: boolean;
    search: (q: string) => Promise<void>;
    clear: () => void;
}

export const useSmartSearch = (
    session: SessionContext | null,
    config: Partial<SearchConfig> = {}
): UseSmartSearchReturn => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<LayerResults[]>([]);
    const [loading, setLoading] = useState(false);

    const fullConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);

    const search = useCallback(async (queryText: string) => {
        if (!session || queryText.length < fullConfig.minChars) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            const searchResults = await performSearch(queryText, session, fullConfig);
            setResults(searchResults);
        } catch (error) {
            logger.error('Search error:', error, 'smartSearchService');
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [session, fullConfig]);

    // Debounced search
    const debouncedSearch = useMemo(
        () => debounce(search, fullConfig.debounceMs),
        [search, fullConfig.debounceMs]
    );

    const handleSetQuery = useCallback((q: string) => {
        setQuery(q);
        debouncedSearch(q);
    }, [debouncedSearch]);

    const clear = useCallback(() => {
        setQuery('');
        setResults([]);
    }, []);

    const hasResults = results.length > 0;

    return {
        query,
        setQuery: handleSetQuery,
        results,
        loading,
        hasResults,
        search,
        clear
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Config
    DEFAULT_CONFIG,
    LAYER_CONFIG,

    // Search functions
    searchRooms,
    searchRequests,
    searchMaintenance,
    searchEmployees,
    searchHistory,
    performSearch,

    // Helpers
    highlightMatch,
    debounce,

    // Hook
    useSmartSearch
};
