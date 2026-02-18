/**
 * Live Timer Service
 * Real-time duration counters for requests and room cards
 * Adora Hotel Management System V2
 */

import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface TimerConfig {
    updateIntervalMs: number;
    format: 'short' | 'full';
}

type TimerCallback = (durations: Map<string, string>) => void;

// ============================================================
// STATE
// ============================================================

const DEFAULT_CONFIG: TimerConfig = {
    updateIntervalMs: 1000, // 1 second
    format: 'short',
};

let timerInterval: ReturnType<typeof setInterval> | null = null;
let trackedItems: Map<string, Date> = new Map();
let callbacks: Set<TimerCallback> = new Set();
let currentConfig = DEFAULT_CONFIG;

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Start the live timer service
 */
export function startLiveTimers(config: Partial<TimerConfig> = {}): void {
    currentConfig = { ...DEFAULT_CONFIG, ...config };

    // Stop existing timer
    stopLiveTimers();

    // Start interval
    timerInterval = setInterval(updateAllTimers, currentConfig.updateIntervalMs);

}

/**
 * Stop the timer service
 */
export function stopLiveTimers(): void {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ============================================================
// TRACKING
// ============================================================

/**
 * Track an item's start time
 */
export function trackItem(id: string, startTime: Date | any): void {
    const date = startTime instanceof Date
        ? startTime
        : startTime?.toDate?.() || new Date(startTime);

    trackedItems.set(id, date);
}

/**
 * Untrack an item
 */
export function untrackItem(id: string): void {
    trackedItems.delete(id);
}

/**
 * Track multiple items
 */
export function trackItems(items: Array<{ id: string; startTime: Date | any }>): void {
    items.forEach(item => trackItem(item.id, item.startTime));
}

/**
 * Clear all tracked items
 */
export function clearTracking(): void {
    trackedItems.clear();
}

// ============================================================
// UPDATE LOGIC
// ============================================================

function updateAllTimers(): void {
    const now = new Date();
    const durations: Map<string, string> = new Map();

    trackedItems.forEach((startTime, id) => {
        const duration = formatDuration(startTime, now, currentConfig.format);
        durations.set(id, duration);

        // Also update DOM elements with data-timer-id attribute
        const elements = document.querySelectorAll(`[data-timer-id="${id}"]`);
        elements.forEach(el => {
            el.textContent = duration;
        });
    });

    // Notify callbacks
    callbacks.forEach(cb => cb(durations));
}

// ============================================================
// FORMATTING
// ============================================================

export function formatDuration(startTime: Date, endTime: Date = new Date(), format: 'short' | 'full' = 'short'): string {
    const diffMs = endTime.getTime() - startTime.getTime();

    if (diffMs < 0) return format === 'short' ? '0 د' : '0 دقيقة';

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (format === 'short') {
        if (days > 0) return `${days} ي`;
        if (hours > 0) return `${hours} س ${minutes % 60} د`;
        if (minutes > 0) return `${minutes} د`;
        return `${seconds} ث`;
    } else {
        if (days > 0) return `${days} يوم ${hours % 24} ساعة`;
        if (hours > 0) return `${hours} ساعة ${minutes % 60} دقيقة`;
        if (minutes > 0) return `${minutes} دقيقة`;
        return `${seconds} ثانية`;
    }
}

/**
 * Get elapsed time in minutes
 */
export function getElapsedMinutes(startTime: Date | any): number {
    const start = startTime instanceof Date
        ? startTime
        : startTime?.toDate?.() || new Date(startTime);

    return Math.floor((Date.now() - start.getTime()) / (1000 * 60));
}

/**
 * Get elapsed time with color classification
 */
export function getElapsedWithColor(
    startTime: Date | any,
    warningMinutes: number = 15,
    criticalMinutes: number = 30
): { text: string; color: string; level: 'normal' | 'warning' | 'critical' } {
    const minutes = getElapsedMinutes(startTime);
    const text = formatDuration(
        startTime instanceof Date ? startTime : new Date(startTime)
    );

    if (minutes >= criticalMinutes) {
        return { text, color: '#EF4444', level: 'critical' };
    } else if (minutes >= warningMinutes) {
        return { text, color: '#F59E0B', level: 'warning' };
    }
    return { text, color: '#22C55E', level: 'normal' };
}

// ============================================================
// CALLBACKS
// ============================================================

export function onTimerUpdate(callback: TimerCallback): () => void {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
}

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export function useLiveTimer(startTime: Date | any | null) {
    const [duration, setDuration] = useState('--');
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) return;

        const start = startTime instanceof Date
            ? startTime
            : startTime?.toDate?.() || new Date(startTime);

        const update = () => {
            setDuration(formatDuration(start));
            setElapsed(getElapsedMinutes(start));
        };

        update(); // Initial update
        const interval = setInterval(update, 1000);

        return () => clearInterval(interval);
    }, [startTime]);

    return { duration, elapsedMinutes: elapsed };
}

export function useLiveTimers(items: Array<{ id: string; startTime: Date | any }>) {
    const [durations, setDurations] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        if (items.length === 0) return;

        trackItems(items);
        startLiveTimers();

        const unsubscribe = onTimerUpdate(setDurations);

        return () => {
            unsubscribe();
            clearTracking();
        };
    }, [items.length]);

    const getDuration = useCallback((id: string) => {
        return durations.get(id) || '--';
    }, [durations]);

    return { durations, getDuration };
}

// ============================================================
// TIMER BADGE COMPONENT (for DOM injection)
// ============================================================

export function createTimerBadge(id: string, startTime: Date | any): HTMLElement {
    const badge = document.createElement('span');
    badge.className = 'live-timer-badge';
    badge.dataset.timerId = id;
    badge.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 0.85rem;
        font-weight: 500;
        background: rgba(255,255,255,0.1);
    `;

    // Track and start
    trackItem(id, startTime);

    // Initial value
    const start = startTime instanceof Date
        ? startTime
        : startTime?.toDate?.() || new Date(startTime);
    badge.textContent = `⏱️ ${formatDuration(start)}`;

    return badge;
}

export default {
    startLiveTimers,
    stopLiveTimers,
    trackItem,
    untrackItem,
    trackItems,
    clearTracking,
    formatDuration,
    getElapsedMinutes,
    getElapsedWithColor,
    onTimerUpdate,
    useLiveTimer,
    useLiveTimers,
    createTimerBadge,
};
