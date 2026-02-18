/**
 * Theme Service
 * Dark/Light mode with auto-toggle
 * Adora Hotel Management System V2
 */

import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

type Theme = 'light' | 'dark' | 'auto';

interface ThemeConfig {
    current: Theme;
    autoSchedule: {
        enabled: boolean;
        darkStart: string; // HH:MM
        darkEnd: string;   // HH:MM
    };
    transitions: boolean;
}

// ============================================================
// STATE
// ============================================================

const THEME_KEY = 'adora_theme';
const CONFIG_KEY = 'adora_theme_config';

let currentConfig: ThemeConfig = {
    current: 'auto',
    autoSchedule: {
        enabled: true,
        darkStart: '18:00',
        darkEnd: '06:00'
    },
    transitions: true
};

let appliedTheme: 'light' | 'dark' = 'light';
let autoCheckInterval: number | null = null;
let listeners: ((theme: 'light' | 'dark') => void)[] = [];

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize theme service
 */
export const initTheme = (): void => {
    // Load saved config
    loadConfig();

    // Apply initial theme
    applyTheme();

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleSystemChange);

    // Start auto check if enabled
    if (currentConfig.current === 'auto' && currentConfig.autoSchedule.enabled) {
        startAutoCheck();
    }

    logger.info('✅ Theme service initialized', undefined, 'themeService');
};

/**
 * Load config from localStorage
 */
const loadConfig = (): void => {
    try {
        const saved = localStorage.getItem(CONFIG_KEY);
        if (saved) {
            currentConfig = { ...currentConfig, ...JSON.parse(saved) };
        }
    } catch {
        // Use defaults
    }
};

/**
 * Save config to localStorage
 */
const saveConfig = (): void => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(currentConfig));
};

// ============================================================
// THEME APPLICATION
// ============================================================

/**
 * Apply current theme
 */
const applyTheme = (): void => {
    const theme = resolveTheme();

    // Add transition class if enabled
    if (currentConfig.transitions) {
        document.documentElement.classList.add('theme-transition');
    }

    // Apply theme
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Update meta theme-color
    updateMetaThemeColor(theme);

    // Remove transition class after animation
    if (currentConfig.transitions) {
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 300);
    }

    appliedTheme = theme;
    notifyListeners();
};

/**
 * Resolve current theme based on settings
 */
const resolveTheme = (): 'light' | 'dark' => {
    if (currentConfig.current === 'light') return 'light';
    if (currentConfig.current === 'dark') return 'dark';

    // Auto mode
    if (currentConfig.autoSchedule.enabled) {
        return isNightTime() ? 'dark' : 'light';
    }

    // Use system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Check if current time is night
 */
const isNightTime = (): boolean => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = currentConfig.autoSchedule.darkStart.split(':').map(Number);
    const [endHour, endMin] = currentConfig.autoSchedule.darkEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight range (e.g., 18:00 to 06:00)
    if (startMinutes > endMinutes) {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

/**
 * Update meta theme-color for mobile browsers
 */
const updateMetaThemeColor = (theme: 'light' | 'dark'): void => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', theme === 'dark' ? '#1a1a2e' : '#ffffff');
    }
};

// ============================================================
// AUTO CHECK
// ============================================================

/**
 * Start auto check interval
 */
const startAutoCheck = (): void => {
    if (autoCheckInterval) return;

    // Check every minute
    autoCheckInterval = window.setInterval(() => {
        const shouldBeDark = isNightTime();
        const currentlyDark = appliedTheme === 'dark';

        if (shouldBeDark !== currentlyDark) {
            applyTheme();
            showThemeChangeNotification(shouldBeDark ? 'dark' : 'light');
        }
    }, 60000);
};

/**
 * Stop auto check interval
 */
const stopAutoCheck = (): void => {
    if (autoCheckInterval) {
        clearInterval(autoCheckInterval);
        autoCheckInterval = null;
    }
};

/**
 * Handle system preference change
 */
const handleSystemChange = (): void => {
    if (currentConfig.current === 'auto' && !currentConfig.autoSchedule.enabled) {
        applyTheme();
    }
};

// ============================================================
// THEME CHANGE NOTIFICATION
// ============================================================

/**
 * Show notification when theme changes automatically
 */
const showThemeChangeNotification = (theme: 'light' | 'dark'): void => {
    const notification = document.createElement('div');
    notification.className = `
        fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
        bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/20
        text-white px-6 py-3 rounded-full
        flex items-center gap-3
        animate-slide-down
    `;

    notification.innerHTML = `
        <span class="text-xl">${theme === 'dark' ? '🌙' : '☀️'}</span>
        <span>${theme === 'dark' ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري'}</span>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slide-up 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Set theme
 */
export const setTheme = (theme: Theme): void => {
    currentConfig.current = theme;
    saveConfig();

    if (theme === 'auto' && currentConfig.autoSchedule.enabled) {
        startAutoCheck();
    } else {
        stopAutoCheck();
    }

    applyTheme();
};

/**
 * Toggle between light and dark
 */
export const toggleTheme = (): 'light' | 'dark' => {
    const newTheme = appliedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    return newTheme;
};

/**
 * Get current theme
 */
export const getCurrentTheme = (): 'light' | 'dark' => {
    return appliedTheme;
};

/**
 * Get theme config
 */
export const getThemeConfig = (): ThemeConfig => {
    return { ...currentConfig };
};

/**
 * Update auto schedule
 */
export const setAutoSchedule = (darkStart: string, darkEnd: string, enabled = true): void => {
    currentConfig.autoSchedule = { enabled, darkStart, darkEnd };
    saveConfig();

    if (currentConfig.current === 'auto') {
        if (enabled) {
            startAutoCheck();
        } else {
            stopAutoCheck();
        }
        applyTheme();
    }
};

/**
 * Enable/disable transitions
 */
export const setTransitions = (enabled: boolean): void => {
    currentConfig.transitions = enabled;
    saveConfig();
};

/**
 * Subscribe to theme changes
 */
export const subscribeToTheme = (callback: (theme: 'light' | 'dark') => void): (() => void) => {
    listeners.push(callback);
    callback(appliedTheme);

    return () => {
        listeners = listeners.filter(l => l !== callback);
    };
};

/**
 * Notify listeners
 */
const notifyListeners = (): void => {
    listeners.forEach(l => l(appliedTheme));
};

// ============================================================
// INJECT STYLES
// ============================================================

/**
 * Inject required CSS
 */
export const injectThemeStyles = (): void => {
    if (document.getElementById('adora-theme-styles')) return;

    const style = document.createElement('style');
    style.id = 'adora-theme-styles';
    style.textContent = `
        .theme-transition,
        .theme-transition * {
            transition: background-color 0.3s ease, 
                        color 0.3s ease, 
                        border-color 0.3s ease,
                        box-shadow 0.3s ease !important;
        }
        
        @keyframes slide-down {
            from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
            to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        
        @keyframes slide-up {
            from { transform: translateX(-50%) translateY(0); opacity: 1; }
            to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        }
        
        .animate-slide-down {
            animation: slide-down 0.3s ease;
        }
        
        /* Light mode variables */
        :root {
            --bg-primary: #ffffff;
            --bg-secondary: #f5f5f5;
            --text-primary: #1a1a2e;
            --text-secondary: #666666;
        }
        
        /* Dark mode variables */
        .dark {
            --bg-primary: #1a1a2e;
            --bg-secondary: #16213e;
            --text-primary: #ffffff;
            --text-secondary: #a0a0a0;
        }
    `;

    document.head.appendChild(style);
};

// Initialize styles
if (typeof window !== 'undefined') {
    injectThemeStyles();
}

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const useTheme = () => {
    const [theme, setThemeState] = useState<'light' | 'dark'>(appliedTheme);
    const [config, setConfig] = useState<ThemeConfig>(currentConfig);

    useEffect(() => {
        initTheme();
        const unsubscribe = subscribeToTheme(setThemeState);
        return unsubscribe;
    }, []);

    const toggle = useCallback(() => {
        const newTheme = toggleTheme();
        setThemeState(newTheme);
    }, []);

    const setMode = useCallback((mode: Theme) => {
        setTheme(mode);
        setConfig(getThemeConfig());
    }, []);

    const updateSchedule = useCallback((start: string, end: string, enabled?: boolean) => {
        setAutoSchedule(start, end, enabled);
        setConfig(getThemeConfig());
    }, []);

    return {
        theme,
        isDark: theme === 'dark',
        config,
        toggle,
        setMode,
        updateSchedule
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    initTheme,
    setTheme,
    toggleTheme,
    getCurrentTheme,
    getThemeConfig,
    setAutoSchedule,
    setTransitions,
    subscribeToTheme,
    injectThemeStyles,
    useTheme
};
