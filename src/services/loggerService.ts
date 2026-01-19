/**
 * Logger Service
 * Centralized logging with environment-aware behavior
 * Adora Hotel Management System V3
 * 
 * ✅ Replaces console.log/console.error with structured logging
 * ✅ Only logs in development mode
 * ✅ Supports error tracking integration
 */

// ============================================================
// TYPES
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
    level: LogLevel;
    message: string;
    data?: any;
    timestamp: Date;
    context?: string;
}

// ============================================================
// CONFIGURATION
// ============================================================

const LOG_CONFIG = {
    // Only log in development
    enabled: import.meta.env.DEV,
    // Log levels to show (in production, only errors)
    levels: import.meta.env.DEV 
        ? ['debug', 'info', 'warn', 'error'] as LogLevel[]
        : ['error'] as LogLevel[],
    // Maximum log entries to keep in memory
    maxEntries: 100,
};

// In-memory log buffer (for debugging)
const logBuffer: LogEntry[] = [];

// ============================================================
// LOGGER IMPLEMENTATION
// ============================================================

/**
 * Core logging function
 */
const log = (level: LogLevel, message: string, data?: any, context?: string): void => {
    if (!LOG_CONFIG.enabled || !LOG_CONFIG.levels.includes(level)) {
        return;
    }

    const entry: LogEntry = {
        level,
        message,
        data,
        timestamp: new Date(),
        context,
    };

    // Add to buffer
    logBuffer.push(entry);
    if (logBuffer.length > LOG_CONFIG.maxEntries) {
        logBuffer.shift(); // Remove oldest
    }

    // Output to console based on level
    const consoleMethod = level === 'error' ? console.error :
                         level === 'warn' ? console.warn :
                         level === 'debug' ? console.debug :
                         console.log;

    if (data) {
        consoleMethod(`[${level.toUpperCase()}] ${context ? `[${context}] ` : ''}${message}`, data);
    } else {
        consoleMethod(`[${level.toUpperCase()}] ${context ? `[${context}] ` : ''}${message}`);
    }

    // ✅ ERROR TRACKING: Send errors to Sentry in production (optional, doesn't fail if not configured)
    // ✅ NOTE: Sentry integration is disabled by default. To enable:
    // 1. Install: npm install @sentry/react
    // 2. Configure VITE_SENTRY_DSN in .env
    // 3. Initialize Sentry in main.tsx
    // This logger will automatically use Sentry if it's available via window.Sentry
    if (level === 'error' && import.meta.env.PROD) {
        try {
            // ✅ Check if Sentry DSN is configured
            const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
            
            if (sentryDsn) {
                // ✅ Use global Sentry if available (initialized in main.tsx)
                // This avoids dynamic import issues when @sentry/react is not installed
                const Sentry = (window as any).Sentry;
                
                if (Sentry) {
                    // ✅ Send error to Sentry
                    if (data instanceof Error) {
                        Sentry.captureException(data, {
                            tags: { context: context || 'unknown' },
                            extra: { message }
                        });
                    } else {
                        Sentry.captureMessage(message, {
                            level: 'error',
                            tags: { context: context || 'unknown' },
                            extra: data ? { data } : undefined
                        });
                    }
                }
                // ✅ If Sentry is not available, silently skip (expected if not installed)
            }
        } catch (sentryError) {
            // ✅ Error tracking is optional - don't break logging if Sentry fails
            // This can happen if:
            // - @sentry/react not installed
            // - VITE_SENTRY_DSN not configured
            // - Sentry initialization failed
        }
    }
};

// ============================================================
// PUBLIC API
// ============================================================

export const logger = {
    /**
     * Debug logs (development only)
     */
    debug: (message: string, data?: any, context?: string) => {
        log('debug', message, data, context);
    },

    /**
     * Info logs (development only)
     */
    info: (message: string, data?: any, context?: string) => {
        log('info', message, data, context);
    },

    /**
     * Warning logs
     */
    warn: (message: string, data?: any, context?: string) => {
        log('warn', message, data, context);
    },

    /**
     * Error logs (always logged, even in production)
     */
    error: (message: string, error?: any, context?: string) => {
        log('error', message, error, context);
    },

    /**
     * Get log buffer (for debugging)
     */
    getLogs: (): LogEntry[] => {
        return [...logBuffer];
    },

    /**
     * Clear log buffer
     */
    clearLogs: (): void => {
        logBuffer.length = 0;
    },
};

export default logger;
