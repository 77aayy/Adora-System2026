/**
 * History Filter Service
 * Migrated from history-filter.js with TypeScript and React components
 * Adora Hotel Management System V2
 */

import React, { useState, useCallback, useMemo } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface ActionFilter {
    value: string;
    label: string;
    icon?: string;
}

export interface FilterState {
    action: string;
    period: Period;
    customFrom: Date | null;
    customTo: Date | null;
}

export type Period = 'today' | 'yesterday' | 'lastWeek' | 'lastMonth' | 'custom';

export interface DateRange {
    from: Date;
    to: Date;
}

interface HistoryFilterConfig {
    actionFilters?: ActionFilter[];
    defaultPeriod?: Period;
    defaultAction?: string;
    onFilterChange?: (filter: FilterState, dateRange: DateRange) => void;
}

// ============================================================
// DATE RANGE UTILITIES
// ============================================================

/**
 * Get date range based on period
 */
export const getDateRange = (
    period: Period,
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

        default:
            from = new Date(today);
            to = new Date(today);
            to.setHours(23, 59, 59, 999);
    }

    return { from, to };
};

/**
 * Check if date is in range
 */
export const isDateInRange = (
    date: Date | { toDate: () => Date } | null | undefined,
    from: Date,
    to: Date
): boolean => {
    if (!date) return false;

    const checkDate = (date as any).toDate ? (date as any).toDate() : new Date(date as Date);
    return checkDate >= from && checkDate <= to;
};

/**
 * Format date for input
 */
export const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

/**
 * Parse date from input
 */
export const parseDateFromInput = (dateString: string): Date | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
};

// ============================================================
// PERIOD LABELS
// ============================================================

export const PERIOD_LABELS: Record<Period, string> = {
    today: 'اليوم',
    yesterday: 'أمس',
    lastWeek: 'الأسبوع الماضي',
    lastMonth: 'الشهر الماضي',
    custom: 'تاريخ مخصص'
};

export const PERIODS: Period[] = ['today', 'yesterday', 'lastWeek', 'lastMonth', 'custom'];

// ============================================================
// REACT HOOK
// ============================================================

export const useHistoryFilter = (config: HistoryFilterConfig = {}) => {
    const {
        defaultPeriod = 'today',
        defaultAction = 'all',
        onFilterChange
    } = config;

    const [filter, setFilter] = useState<FilterState>({
        action: defaultAction,
        period: defaultPeriod,
        customFrom: null,
        customTo: null
    });

    const dateRange = useMemo(() =>
        getDateRange(filter.period, filter.customFrom, filter.customTo),
        [filter.period, filter.customFrom, filter.customTo]
    );

    const setAction = useCallback((action: string) => {
        setFilter(prev => {
            const newFilter = { ...prev, action };
            onFilterChange?.(newFilter, getDateRange(newFilter.period, newFilter.customFrom, newFilter.customTo));
            return newFilter;
        });
    }, [onFilterChange]);

    const setPeriod = useCallback((period: Period) => {
        setFilter(prev => {
            const newFilter = { ...prev, period };
            if (period !== 'custom') {
                newFilter.customFrom = null;
                newFilter.customTo = null;
            }
            onFilterChange?.(newFilter, getDateRange(newFilter.period, newFilter.customFrom, newFilter.customTo));
            return newFilter;
        });
    }, [onFilterChange]);

    const setCustomDates = useCallback((from: Date | null, to: Date | null) => {
        setFilter(prev => {
            const newFilter = { ...prev, customFrom: from, customTo: to };
            onFilterChange?.(newFilter, getDateRange(newFilter.period, from, to));
            return newFilter;
        });
    }, [onFilterChange]);

    const reset = useCallback(() => {
        const newFilter: FilterState = {
            action: defaultAction,
            period: defaultPeriod,
            customFrom: null,
            customTo: null
        };
        setFilter(newFilter);
        onFilterChange?.(newFilter, getDateRange(defaultPeriod));
    }, [defaultAction, defaultPeriod, onFilterChange]);

    const filterData = useCallback(<T extends { [key: string]: any }>(
        data: T[],
        dateField: keyof T,
        actionField?: keyof T
    ): T[] => {
        return data.filter(item => {
            const date = item[dateField];
            if (!isDateInRange(date, dateRange.from, dateRange.to)) {
                return false;
            }

            if (filter.action !== 'all' && actionField && item[actionField] !== filter.action) {
                return false;
            }

            return true;
        });
    }, [filter.action, dateRange]);

    return {
        filter,
        dateRange,
        setAction,
        setPeriod,
        setCustomDates,
        reset,
        filterData,
        isDateInRange: (date: any) => isDateInRange(date, dateRange.from, dateRange.to)
    };
};

// ============================================================
// REACT COMPONENT
// ============================================================

interface HistoryFilterProps {
    actionFilters?: ActionFilter[];
    value: FilterState;
    onChange: (filter: FilterState) => void;
    showActionFilter?: boolean;
    className?: string;
}

export const HistoryFilter: React.FC<HistoryFilterProps> = ({
    actionFilters = [],
    value,
    onChange,
    showActionFilter = true,
    className = ''
}) => {
    const handleActionChange = (action: string) => {
        onChange({ ...value, action });
    };

    const handlePeriodChange = (period: Period) => {
        onChange({
            ...value,
            period,
            customFrom: period !== 'custom' ? null : value.customFrom,
            customTo: period !== 'custom' ? null : value.customTo
        });
    };

    const handleFromDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const from = parseDateFromInput(e.target.value);
        onChange({ ...value, customFrom: from });
    };

    const handleToDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const to = parseDateFromInput(e.target.value);
        onChange({ ...value, customTo: to });
    };

    return React.createElement('div', { className: `history-filters ${className}` }, [
        // Action Filter
        showActionFilter && actionFilters.length > 0 && React.createElement('div', {
            key: 'action-filter',
            className: 'filter-group'
        }, [
            React.createElement('label', { key: 'label', className: 'filter-label' }, 'نوع العمل'),
            React.createElement('div', { key: 'buttons', className: 'filter-buttons' }, [
                React.createElement('button', {
                    key: 'all',
                    type: 'button',
                    className: `filter-btn ${value.action === 'all' ? 'active' : ''}`,
                    onClick: () => handleActionChange('all')
                }, 'الكل'),
                ...actionFilters.map(action =>
                    React.createElement('button', {
                        key: action.value,
                        type: 'button',
                        className: `filter-btn ${value.action === action.value ? 'active' : ''}`,
                        onClick: () => handleActionChange(action.value)
                    }, `${action.icon || ''} ${action.label}`)
                )
            ])
        ]),

        // Period Filter
        React.createElement('div', { key: 'period-filter', className: 'filter-group' }, [
            React.createElement('label', { key: 'label', className: 'filter-label' }, 'الفترة الزمنية'),
            React.createElement('div', { key: 'buttons', className: 'filter-buttons' },
                PERIODS.map(period =>
                    React.createElement('button', {
                        key: period,
                        type: 'button',
                        className: `filter-btn ${value.period === period ? 'active' : ''}`,
                        onClick: () => handlePeriodChange(period)
                    }, PERIOD_LABELS[period])
                )
            )
        ]),

        // Custom Date Range
        value.period === 'custom' && React.createElement('div', {
            key: 'custom-range',
            className: 'filter-group'
        }, [
            React.createElement('label', { key: 'label', className: 'filter-label' }, 'من - إلى'),
            React.createElement('div', { key: 'inputs', className: 'date-range-inputs' }, [
                React.createElement('input', {
                    key: 'from',
                    type: 'date',
                    className: 'form-input',
                    value: value.customFrom ? formatDateForInput(value.customFrom) : '',
                    onChange: handleFromDateChange
                }),
                React.createElement('span', { key: 'sep', className: 'date-separator' }, 'إلى'),
                React.createElement('input', {
                    key: 'to',
                    type: 'date',
                    className: 'form-input',
                    value: value.customTo ? formatDateForInput(value.customTo) : '',
                    onChange: handleToDateChange
                })
            ])
        ])
    ]);
};

// ============================================================
// CSS STYLES
// ============================================================

export const historyFilterStyles = `
.history-filters {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    margin-bottom: 16px;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.filter-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
}

.filter-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.filter-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
}

.filter-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
}

.filter-btn.active {
    background: linear-gradient(135deg, #3B82F6, #2563EB);
    border-color: transparent;
    color: white;
    font-weight: 600;
}

.date-range-inputs {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.date-separator {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
}

.form-input {
    padding: 10px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: white;
    font-size: 0.9rem;
}

.form-input:focus {
    outline: none;
    border-color: #3B82F6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}
`;

// ============================================================
// LEGACY SUPPORT
// ============================================================

/**
 * Create filter HTML for legacy pages
 */
export const createHistoryFilterHTML = (config: HistoryFilterConfig = {}): string => {
    const { actionFilters = [] } = config;

    return `
        <div class="history-filters">
            ${actionFilters.length > 0 ? `
                <div class="filter-group">
                    <label class="filter-label">نوع العمل</label>
                    <div class="filter-buttons">
                        <button type="button" class="filter-btn active" data-action="all" onclick="selectHistoryAction('all')">
                            الكل
                        </button>
                        ${actionFilters.map(action => `
                            <button type="button" class="filter-btn" data-action="${action.value}" onclick="selectHistoryAction('${action.value}')">
                                ${action.icon || ''} ${action.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="filter-group">
                <label class="filter-label">الفترة الزمنية</label>
                <div class="filter-buttons">
                    ${PERIODS.map(period => `
                        <button type="button" class="filter-btn ${period === 'today' ? 'active' : ''}" data-period="${period}" onclick="selectHistoryPeriod('${period}')">
                            ${PERIOD_LABELS[period]}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="filter-group hidden" id="custom-date-range">
                <label class="filter-label">من - إلى</label>
                <div class="date-range-inputs">
                    <input type="date" id="history-date-from" class="form-input" onchange="updateHistoryFilter()">
                    <span class="date-separator">إلى</span>
                    <input type="date" id="history-date-to" class="form-input" onchange="updateHistoryFilter()">
                </div>
            </div>
        </div>
    `;
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Date utilities
    getDateRange,
    isDateInRange,
    formatDateForInput,
    parseDateFromInput,

    // Constants
    PERIOD_LABELS,
    PERIODS,

    // React
    useHistoryFilter,
    HistoryFilter,
    historyFilterStyles,

    // Legacy
    createHistoryFilterHTML
};
