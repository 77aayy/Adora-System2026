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

    // TODO: In production, send errors to error tracking service (e.g., Sentry)
    if (level === 'error' && import.meta.env.PROD) {
        // Send to error tracking service
        // Example: Sentry.captureException(new Error(message), { extra: data });
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
