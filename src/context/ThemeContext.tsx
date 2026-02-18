/**
 * Theme Context
 * Manages application theme (light/dark)
 * Adora Hotel Management System V2
 * 
 * Updated to work with theme-system.css
 * Uses data-theme attribute for CSS variable switching
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeMode;
    isDark: boolean;
    isLight: boolean;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
}

// ============================================================
// CONTEXT
// ============================================================

const ThemeContext = createContext<ThemeContextType>({
    theme: 'light',
    isDark: false,
    isLight: true,
    setTheme: () => { },
    toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

// ============================================================
// STORAGE
// ============================================================

const STORAGE_KEY = 'adora_theme';

// ============================================================
// HELPER: Get initial theme
// ============================================================

// Migration flag to force light theme once
const MIGRATION_KEY = 'adora_theme_v2_migrated';

const getInitialTheme = (): ThemeMode => {
    if (typeof window !== 'undefined') {
        // ✅ ONE-TIME MIGRATION: Force light mode for existing users
        const hasMigrated = localStorage.getItem(MIGRATION_KEY);
        if (!hasMigrated) {
            localStorage.setItem(STORAGE_KEY, 'light');
            localStorage.setItem(MIGRATION_KEY, 'true');
            return 'light';
        }
        
        // After migration, respect user preference
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'light';
    }

    return 'light';
};

// ============================================================
// PROVIDER
// ============================================================

interface ThemeProviderProps {
    children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

    // Apply theme to document
    const applyTheme = useCallback((newTheme: ThemeMode) => {
        const root = document.documentElement;

        // Set data-theme attribute (for theme-system.css)
        root.setAttribute('data-theme', newTheme);

        // Also update class for Tailwind dark mode support
        if (newTheme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.add('light');
            root.classList.remove('dark');
        }

        // Update meta theme-color for mobile browsers
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute(
                'content',
                newTheme === 'dark' ? '#0f172a' : '#f8fafc'
            );
        }

        // تحديث خلفية body مع انتقال سلس
        document.body.style.transition = 'background-color 0.5s ease, color 0.5s ease';
        document.body.style.backgroundColor = newTheme === 'dark' ? '#0f172a' : '#f8fafc';
        document.body.style.color = newTheme === 'dark' ? '#f8fafc' : '#1e293b';
    }, []);

    // Apply theme on mount
    useEffect(() => {
        applyTheme(theme);
    }, [theme, applyTheme]);

    // Apply saved branding colors (from DynamicBrandingSection) on load
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const primary = localStorage.getItem('adora_primary_color');
        const secondary = localStorage.getItem('adora_secondary_color');
        if (!primary || !secondary) return;
        const root = document.documentElement.style;
        root.setProperty('--color-primary', primary);
        root.setProperty('--color-secondary', secondary);
        root.setProperty('--theme-primary-500', primary);
        root.setProperty('--theme-primary-400', secondary);
        root.setProperty('--theme-primary-600', primary);
        root.setProperty('--theme-gradient-primary', `linear-gradient(135deg, ${secondary} 0%, ${primary} 100%)`);
    }, []);

    // Persist theme to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    // Listen for system theme changes (only if no user preference)
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            // Only update if user hasn't explicitly set a preference
            const savedTheme = localStorage.getItem(STORAGE_KEY);
            if (!savedTheme) {
                setThemeState(e.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    // Set theme and persist
    const setTheme = useCallback((newTheme: ThemeMode) => {
        setThemeState(newTheme);
    }, []);

    // Toggle between light and dark
    const toggleTheme = useCallback(() => {
        setThemeState(prev => prev === 'light' ? 'dark' : 'light');
    }, []);

    // Context value
    const value: ThemeContextType = {
        theme,
        isDark: theme === 'dark',
        isLight: theme === 'light',
        setTheme,
        toggleTheme,
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
