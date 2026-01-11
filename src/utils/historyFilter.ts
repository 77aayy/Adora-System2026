/**
 * History Filter Utility
 * Date range filtering for logs and history
 * Adora Hotel Management System V2
 */

import { useState, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

export type FilterPeriod = 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'custom' | 'all';

export interface DateRange {
    from: Date;
    to: Date;
}

export interface HistoryFilterState {
    period: FilterPeriod;
    action: string;
    customFrom: Date | null;
    customTo: Date | null;
}

export interface ActionFilter {
    value: string;
    label: string;
    icon?: string;
}

// ============================================================
// DATE RANGE CALCULATIONS
// ============================================================

/**
 * Get date range for a given period
 */
export const getDateRange = (
    period: FilterPeriod,
    customFrom?: Date | null,
    customTo?: Date | null
): DateRange => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let from: Date;
    let to: Date;

    switch (period) {
        case 'today':
            from = new Date(today);
            to = new Date(today);
            to.setHours(23, 59, 59, 999);
            break;

        case 'yesterday':
            from = new Date(today);
            from.setDate(from.getDate() - 1);
            to = new Date(today);
            to.setDate(to.getDate() - 1);
            to.setHours(23, 59, 59, 999);
            break;

        case 'lastWeek':
            from = new Date(today);
            from.setDate(from.getDate() - 7);
            to = new Date(today);
            to.setHours(23, 59, 59, 999);
            break;

        case 'lastMonth':
            from = new Date(today);
            from.setMonth(from.getMonth() - 1);
            to = new Date(today);
            to.setHours(23, 59, 59, 999);
            break;

        case 'custom':
            if (customFrom && customTo) {
                from = new Date(customFrom);
                from.setHours(0, 0, 0, 0);
                to = new Date(customTo);
                to.setHours(23, 59, 59, 999);
            } else {
                // Default: last 30 days
                from = new Date(today);
                from.setDate(from.getDate() - 30);
                to = new Date(today);
                to.setHours(23, 59, 59, 999);
            }
            break;

        case 'all':
        default:
            // All time - from beginning of 2024 to now
            from = new Date(2024, 0, 1);
            to = new Date(today);
            to.setHours(23, 59, 59, 999);
    }

    return { from, to };
};

/**
 * Check if date is within range
 */
export const isDateInRange = (
    date: Date | { toDate: () => Date } | null | undefined,
    from: Date,
    to: Date
): boolean => {
    if (!date) return false;

    const checkDate = typeof (date as any).toDate === 'function'
        ? (date as { toDate: () => Date }).toDate()
        : new Date(date as Date);

    return checkDate >= from && checkDate <= to;
};

/**
 * Format date for display
 */
export const formatDateForDisplay = (date: Date): string => {
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

/**
 * Get period label in Arabic
 */
export const getPeriodLabel = (period: FilterPeriod): string => {
    const labels: Record<FilterPeriod, string> = {
        today: 'اليوم',
        yesterday: 'أمس',
        lastWeek: 'الأسبوع الماضي',
        lastMonth: 'الشهر الماضي',
        custom: 'تاريخ مخصص',
        all: 'الكل',
    };
    return labels[period];
};

// ============================================================
// REACT HOOK
// ============================================================

/**
 * React hook for history filtering
 */
export const useHistoryFilter = (initialPeriod: FilterPeriod = 'today') => {
    const [filterState, setFilterState] = useState<HistoryFilterState>({
        period: initialPeriod,
        action: 'all',
        customFrom: null,
        customTo: null,
    });

    const setPeriod = useCallback((period: FilterPeriod) => {
        setFilterState(prev => ({ ...prev, period }));
    }, []);

    const setAction = useCallback((action: string) => {
        setFilterState(prev => ({ ...prev, action }));
    }, []);

    const setCustomRange = useCallback((from: Date, to: Date) => {
        setFilterState(prev => ({
            ...prev,
            period: 'custom',
            customFrom: from,
            customTo: to,
        }));
    }, []);

    const getRange = useCallback((): DateRange => {
        return getDateRange(
            filterState.period,
            filterState.customFrom,
            filterState.customTo
        );
    }, [filterState]);

    const filterByDate = useCallback(<T extends { createdAt?: Date | any }>(
        items: T[]
    ): T[] => {
        const range = getRange();
        return items.filter(item =>
            isDateInRange(item.createdAt, range.from, range.to)
        );
    }, [getRange]);

    const filterByAction = useCallback(<T extends { type?: string; action?: string }>(
        items: T[]
    ): T[] => {
        if (filterState.action === 'all') return items;
        return items.filter(item =>
            item.type === filterState.action || item.action === filterState.action
        );
    }, [filterState.action]);

    const applyFilters = useCallback(<T extends { createdAt?: Date | any; type?: string; action?: string }>(
        items: T[]
    ): T[] => {
        let filtered = filterByDate(items);
        filtered = filterByAction(filtered);
        return filtered;
    }, [filterByDate, filterByAction]);

    return {
        filterState,
        setPeriod,
        setAction,
        setCustomRange,
        getRange,
        filterByDate,
        filterByAction,
        applyFilters,
    };
};

// ============================================================
// PREDEFINED ACTION FILTERS
// ============================================================

export const BELLMAN_ACTIONS: ActionFilter[] = [
    { value: 'checkin', label: 'تسجيل دخول', icon: '🟢' },
    { value: 'checkout', label: 'تسجيل خروج', icon: '🔴' },
    { value: 'complete', label: 'طلب مكتمل', icon: '✅' },
];

export const HOUSEKEEPING_ACTIONS: ActionFilter[] = [
    { value: 'cleaning', label: 'تنظيف', icon: '🧹' },
    { value: 'inspection', label: 'فحص', icon: '🔍' },
    { value: 'maintenance', label: 'صيانة', icon: '🔧' },
];

export const RECEPTION_ACTIONS: ActionFilter[] = [
    { value: 'create', label: 'إنشاء طلب', icon: '➕' },
    { value: 'confirm', label: 'تأكيد', icon: '✓' },
    { value: 'complete', label: 'إكمال', icon: '✅' },
    { value: 'cancel', label: 'إلغاء', icon: '❌' },
];
