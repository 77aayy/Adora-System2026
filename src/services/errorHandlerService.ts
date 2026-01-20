/**
 * Error Handler Service
 * Migrated from error-handler.js with TypeScript and React integration
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// ============================================================
// CONFIGURATION
// ============================================================

const MAX_ERRORS = 10; // ✅ Increased to prevent too many false positives
const ERROR_RESET_INTERVAL = 30000; // ✅ Reset counter every 30 seconds
const MAX_STORED_ERRORS = 50;
const STORAGE_KEY = 'adora_errors';

// ============================================================
// TYPES
// ============================================================

interface ErrorInfo {
    type: 'error' | 'unhandledRejection' | 'safeExecute' | 'firebase' | 'network' | 'custom';
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    stack?: string;
    timestamp?: number;
    url?: string;
    userAgent?: string;
    userId?: string;
    extra?: Record<string, any>;
}

interface ErrorMapping {
    pattern: string;
    message: string;
}

// ============================================================
// ERROR MESSAGES (Arabic)
// ============================================================

const ERROR_MAPPINGS: ErrorMapping[] = [
    // Network errors
    { pattern: 'Failed to fetch', message: 'خطأ في الاتصال بالخادم' },
    { pattern: 'Network Error', message: 'خطأ في الشبكة' },
    { pattern: 'NetworkError', message: 'خطأ في الشبكة' },
    { pattern: 'timeout', message: 'انتهت مهلة الاتصال' },
    { pattern: 'net::ERR', message: 'فشل الاتصال بالإنترنت' },
    { pattern: 'offline', message: 'أنت غير متصل بالإنترنت' },

    // Firebase errors
    { pattern: 'PERMISSION_DENIED', message: 'ليس لديك صلاحية لهذا الإجراء' },
    { pattern: 'permission-denied', message: 'ليس لديك صلاحية لهذا الإجراء' },
    { pattern: 'NOT_FOUND', message: 'المورد غير موجود' },
    { pattern: 'not-found', message: 'البيانات غير موجودة' },
    { pattern: 'already-exists', message: 'البيانات موجودة مسبقاً' },
    { pattern: 'unauthenticated', message: 'يجب تسجيل الدخول أولاً' },
    { pattern: 'invalid-argument', message: 'بيانات غير صحيحة' },
    { pattern: 'resource-exhausted', message: 'تم تجاوز الحد المسموح' },
    { pattern: 'unavailable', message: 'الخدمة غير متاحة حالياً' },
    { pattern: 'deadline-exceeded', message: 'انتهت مهلة العملية' },

    // JavaScript errors
    { pattern: 'undefined is not', message: 'خطأ في البيانات' },
    { pattern: 'Cannot read prop', message: 'خطأ في قراءة البيانات' },
    { pattern: 'null', message: 'بيانات فارغة' },
    { pattern: 'is not a function', message: 'خطأ في تنفيذ العملية' },

    // Storage errors
    { pattern: 'Quota exceeded', message: 'تم تجاوز حد التخزين' },
    { pattern: 'QuotaExceededError', message: 'المساحة ممتلئة' },

    // Auth errors
    { pattern: 'wrong-password', message: 'كلمة المرور غير صحيحة' },
    { pattern: 'user-not-found', message: 'المستخدم غير موجود' },
    { pattern: 'email-already-in-use', message: 'البريد مستخدم مسبقاً' },
    { pattern: 'weak-password', message: 'كلمة المرور ضعيفة' },
    { pattern: 'invalid-email', message: 'البريد الإلكتروني غير صحيح' },
    { pattern: 'too-many-requests', message: 'محاولات كثيرة، حاول لاحقاً' }
];

// ============================================================
// STATE
// ============================================================

let errorCount = 0;
let isInitialized = false;
let resetIntervalId: NodeJS.Timeout | null = null;

// ============================================================
// ERROR SIMPLIFICATION
// ============================================================

/**
 * Simplify error message for user
 */
export const simplifyErrorMessage = (message: string): string => {
    if (!message) return 'حدث خطأ غير متوقع';

    for (const mapping of ERROR_MAPPINGS) {
        if (message.includes(mapping.pattern)) {
            return mapping.message;
        }
    }

    return 'حدث خطأ غير متوقع';
};

/**
 * Get Firebase error message
 */
export const getFirebaseErrorMessage = (code: string): string => {
    const mapping = ERROR_MAPPINGS.find(m => code.includes(m.pattern));
    return mapping?.message || 'حدث خطأ في قاعدة البيانات';
};

// ============================================================
// ERROR LOGGING
// ============================================================

/**
 * Log error to localStorage
 */
export const logError = (errorInfo: Partial<ErrorInfo>): void => {
    try {
        const errors = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        errors.push({
            ...errorInfo,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent
        });

        // Keep only last MAX_STORED_ERRORS
        if (errors.length > MAX_STORED_ERRORS) {
            errors.splice(0, errors.length - MAX_STORED_ERRORS);
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
    } catch (e) {
        // Ignore storage errors
    }
};

/**
 * Log error to Firestore (for critical errors)
 */
export const logErrorToFirestore = async (
    errorInfo: Partial<ErrorInfo>,
    userId?: string
): Promise<void> => {
    try {
        await addDoc(collection(db, 'errorLogs'), {
            ...errorInfo,
            userId: userId || null,
            timestamp: serverTimestamp(),
            url: window.location.href,
            userAgent: navigator.userAgent
        });
    } catch (e) {
        console.error('Failed to log error to Firestore:', e);
    }
};

/**
 * Get error log from localStorage
 */
export const getErrorLog = (): ErrorInfo[] => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
};

/**
 * Generate a complete diagnostic report for debugging
 */
export const generateDiagnosticReport = (): string => {
    const errors = getErrorLog();
    const timestamp = new Date().toLocaleString('ar-SA');
    const userAgent = navigator.userAgent;
    const url = window.location.href;

    let report = `=== ADORA DIAGNOSTIC REPORT ===\n`;
    report += `Timestamp: ${timestamp}\n`;
    report += `URL: ${url}\n`;
    report += `User Agent: ${userAgent}\n`;
    report += `LocalStorage Keys: ${Object.keys(localStorage).join(', ')}\n`;
    report += `Total Errors in Log: ${errors.length}\n`;
    report += `\n--- ERROR LOG (Last ${MAX_STORED_ERRORS}) ---\n`;

    if (errors.length === 0) {
        report += `No errors recorded.\n`;
    } else {
        errors.reverse().forEach((err, i) => {
            report += `[${i + 1}] ${new Date(err.timestamp || 0).toLocaleTimeString()} | ${err.type}\n`;
            report += `Message: ${err.message}\n`;
            if (err.filename) report += `File: ${err.filename}:${err.lineno}:${err.colno}\n`;
            if (err.stack) report += `Stack: ${err.stack.substring(0, 300)}...\n`;
            report += `-------------------\n`;
        });
    }

    return report;
};

/**
 * Copy diagnostic report to clipboard
 */
export const copyDiagnosticReport = async (): Promise<boolean> => {
    try {
        const report = generateDiagnosticReport();
        await navigator.clipboard.writeText(report);
        console.log('📋 تم نسخ تقرير التشخيص إلى الحافظة');
        return true;
    } catch (err) {
        console.error('Failed to copy diagnostic report:', err);
        return false;
    }
};

/**
 * Clear error log
 */
export const clearErrorLog = (): void => {
    localStorage.removeItem(STORAGE_KEY);
    errorCount = 0;
    console.log('🧹 تم مسح سجل الأخطاء');
};

// ============================================================
// ERROR HANDLERS
// ============================================================

/**
 * Handle JavaScript error
 */
const handleError = (event: ErrorEvent): void => {
    if (!event.error) return; // Ignore empty errors

    const errorMessage = event.message || '';
    const errorCode = event.error?.code;
    
    // ✅ Don't count Firebase quota errors as critical errors
    const isQuotaError = errorCode === 'resource-exhausted' || 
                         errorCode === 'resource_exhausted' ||
                         errorMessage.includes('quota') ||
                         errorMessage.includes('resource-exhausted');
    
    // ✅ Don't count permission errors as critical errors (expected when not logged in)
    const isPermissionError = errorCode === 'permission-denied' ||
                              errorMessage.includes('permission-denied') ||
                              errorMessage.includes('Missing or insufficient permissions');
    
    // ✅ Don't count ResizeObserver errors
    const isResizeObserverError = errorMessage.includes('ResizeObserver');
    
    // ✅ Don't count Firestore INTERNAL ASSERTION FAILED errors (SDK internal issue)
    const isFirestoreInternalError = errorMessage.includes('INTERNAL ASSERTION FAILED') ||
                                     errorMessage.includes('Unexpected state');
    
    // ✅ Only increment error count for real errors
    if (!isQuotaError && !isPermissionError && !isResizeObserverError && !isFirestoreInternalError) {
        errorCount++;
        console.error('🔴 خطأ غير متوقع:', event.error);
    } else {
        if (isFirestoreInternalError) {
            console.warn('⚠️ Firestore internal error (SDK issue, ignored):', errorMessage);
        } else {
            console.warn('⚠️ Non-critical error (ignored):', errorMessage);
        }
    }

    logError({
        type: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
    });

    if (errorCount >= MAX_ERRORS) {
        showErrorBoundary();
    }
};

/**
 * Handle unhandled promise rejection
 */
const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const errorMessage = event.reason?.message || String(event.reason);
    const errorCode = event.reason?.code;
    
    // ✅ Don't count Firebase quota errors as critical errors
    const isQuotaError = errorCode === 'resource-exhausted' || 
                         errorCode === 'resource_exhausted' ||
                         errorMessage.includes('quota') ||
                         errorMessage.includes('resource-exhausted');
    
    // ✅ Don't count permission errors as critical errors (expected when not logged in)
    const isPermissionError = errorCode === 'permission-denied' ||
                              errorMessage.includes('permission-denied') ||
                              errorMessage.includes('Missing or insufficient permissions');
    
    // ✅ Don't count Firestore INTERNAL ASSERTION FAILED errors (SDK internal issue)
    const isFirestoreInternalError = errorMessage.includes('INTERNAL ASSERTION FAILED') ||
                                     errorMessage.includes('Unexpected state');
    
    // ✅ Only increment error count for real errors
    if (!isQuotaError && !isPermissionError && !isFirestoreInternalError) {
        errorCount++;
        console.error('🔴 Promise غير معالج:', event.reason);
    } else {
        if (isFirestoreInternalError) {
            console.warn('⚠️ Firestore internal error (SDK issue, ignored):', errorMessage);
        } else {
            console.warn('⚠️ Firebase error (ignored):', errorMessage);
        }
    }

    logError({
        type: 'unhandledRejection',
        message: errorMessage,
        stack: event.reason?.stack
    });

    if (errorCount >= MAX_ERRORS) {
        showErrorBoundary();
    }
};

// ============================================================
// ERROR BOUNDARY UI
// ============================================================

/**
 * Show error boundary (full screen error)
 */
export const showErrorBoundary = (): void => {
    if (document.getElementById('error-boundary')) return;

    const boundary = document.createElement('div');
    boundary.id = 'error-boundary';
    boundary.innerHTML = `
        <style>
            #error-boundary {
                position: fixed;
                inset: 0;
                background: linear-gradient(135deg, #1E293B, #0F172A);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                color: white;
                font-family: 'Cairo', 'Tajawal', sans-serif;
                padding: 24px;
                text-align: center;
            }
            #error-boundary .error-card {
                background: linear-gradient(145deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95));
                border: 2px solid rgba(220, 38, 38, 0.5);
                border-radius: 24px;
                padding: 32px 24px;
                max-width: 400px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            }
            #error-boundary .error-icon {
                font-size: 64px;
                margin-bottom: 20px;
                animation: pulse 2s infinite;
            }
            #error-boundary h2 {
                font-size: 1.4rem;
                margin-bottom: 16px;
                color: #EF4444;
                font-weight: 800;
            }
            #error-boundary p {
                color: rgba(255,255,255,0.7);
                margin-bottom: 24px;
                line-height: 1.7;
            }
            #error-boundary .btn-primary {
                background: linear-gradient(135deg, #3B82F6, #2563EB);
                color: white;
                border: none;
                padding: 14px 28px;
                border-radius: 12px;
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
                margin: 6px;
            }
            #error-boundary .btn-secondary {
                background: rgba(255,255,255,0.1);
                color: white;
                border: 1px solid rgba(255,255,255,0.2);
                padding: 14px 28px;
                border-radius: 12px;
                font-size: 1rem;
                cursor: pointer;
                margin: 6px;
            }
            #error-boundary .btn-copy {
                background: rgba(16, 185, 129, 0.1);
                color: #10B981;
                border: 1px solid rgba(16, 185, 129, 0.2);
                padding: 14px 28px;
                border-radius: 12px;
                font-size: 1rem;
                font-weight: 700;
                cursor: pointer;
                margin: 6px;
                transition: all 0.3s;
            }
            #error-boundary .btn-copy:hover {
                background: rgba(16, 185, 129, 0.2);
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        </style>
        <div class="error-card">
            <div class="error-icon">⚠️</div>
            <h2>حدث خطأ غير متوقع</h2>
            <p>
                لا تقلق، بياناتك محفوظة.<br>
                سيتم إعادة تحميل التطبيق بشكل آمن.
            </p>
            <div>
                <button class="btn-primary" onclick="location.reload()">
                    🔄 إعادة تحميل
                </button>
                <button class="btn-copy" onclick="window.ErrorHandlerService?.copyReport().then(success => { 
                    if(success) {
                        this.innerText = '✅ تم النسخ';
                        this.style.background = '#10B981';
                        this.style.color = 'white';
                        setTimeout(() => {
                            this.innerText = '📋 نسخ التقرير';
                            this.style.background = 'rgba(16, 185, 129, 0.1)';
                            this.style.color = '#10B981';
                        }, 2000);
                    }
                })">
                    📋 نسخ التقرير للمطور
                </button>
                <button class="btn-secondary" onclick="window.ErrorHandlerService?.clearErrorLog(); location.reload();">
                    🧹 مسح السجل
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(boundary);
};

/**
 * Hide error boundary
 */
export const hideErrorBoundary = (): void => {
    document.getElementById('error-boundary')?.remove();
};

// ============================================================
// SAFE EXECUTION WRAPPER
// ============================================================

/**
 * Wrap function with error handling
 */
export function safeExecute<T, Args extends any[]>(
    fn: (...args: Args) => Promise<T>,
    fallback?: T | ((error: Error) => T)
): (...args: Args) => Promise<T | undefined> {
    return async (...args: Args): Promise<T | undefined> => {
        try {
            return await fn(...args);
        } catch (error: any) {
            console.error('❌ خطأ في التنفيذ:', error);

            logError({
                type: 'safeExecute',
                message: error.message,
                stack: error.stack
            });

            if (typeof fallback === 'function') {
                return (fallback as (error: Error) => T)(error);
            }
            return fallback;
        }
    };
}

/**
 * Try-catch wrapper with error handling
 */
export const tryCatch = async <T>(
    fn: () => Promise<T>,
    onError?: (error: Error) => void
): Promise<T | null> => {
    try {
        return await fn();
    } catch (error: any) {
        logError({
            type: 'safeExecute',
            message: error.message,
            stack: error.stack
        });
        onError?.(error);
        return null;
    }
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize error handler
 */
export const initErrorHandler = (): void => {
    if (isInitialized) return;

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Reset error counter periodically
    resetIntervalId = setInterval(() => {
        if (errorCount > 0) {
            errorCount = Math.max(0, errorCount - 1);
        }
    }, ERROR_RESET_INTERVAL);

    isInitialized = true;
    console.log('✅ تم تهيئة نظام معالجة الأخطاء');
};

/**
 * Destroy error handler
 */
export const destroyErrorHandler = (): void => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);

    if (resetIntervalId) {
        clearInterval(resetIntervalId);
        resetIntervalId = null;
    }

    isInitialized = false;
};

// ============================================================
// REACT HOOK
// ============================================================

import { useEffect, useCallback, useState } from 'react';

interface UseErrorHandlerReturn {
    hasError: boolean;
    error: Error | null;
    clearError: () => void;
    handleError: (error: Error) => void;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        initErrorHandler();
        return () => destroyErrorHandler();
    }, []);

    const handleErrorCallback = useCallback((err: Error) => {
        logError({
            type: 'custom',
            message: err.message,
            stack: err.stack
        });
        setError(err);
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        hasError: error !== null,
        error,
        clearError,
        handleError: handleErrorCallback
    };
};

// ============================================================
// REACT ERROR BOUNDARY COMPONENT
// ============================================================

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        logError({
            type: 'error',
            message: error.message,
            stack: error.stack,
            extra: { componentStack: errorInfo.componentStack }
        });
    }

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return React.createElement('div', {
                style: {
                    padding: '24px',
                    textAlign: 'center',
                    background: '#FEF2F2',
                    borderRadius: '12px',
                    margin: '20px',
                    border: '1px solid #FECACA'
                }
            }, [
                React.createElement('div', {
                    key: 'icon',
                    style: { fontSize: '48px', marginBottom: '16px' }
                }, '⚠️'),
                React.createElement('h3', {
                    key: 'title',
                    style: { color: '#DC2626', marginBottom: '8px' }
                }, 'حدث خطأ'),
                React.createElement('p', {
                    key: 'message',
                    style: { color: '#7F1D1D', marginBottom: '16px' }
                }, simplifyErrorMessage(this.state.error?.message || '')),
                React.createElement('button', {
                    key: 'button',
                    onClick: () => this.setState({ hasError: false, error: null }),
                    style: {
                        background: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer'
                    }
                }, 'حاول مرة أخرى')
            ]);
        }

        return this.props.children;
    }
}

// ============================================================
// GLOBAL EXPORT FOR LEGACY SUPPORT
// ============================================================

(window as any).ErrorHandlerService = {
    init: initErrorHandler,
    log: logError,
    showBoundary: showErrorBoundary,
    clearErrorLog,
    getLog: getErrorLog,
    safe: safeExecute,
    simplify: simplifyErrorMessage,
    copyReport: copyDiagnosticReport // ✅ Added for UI access
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Initialization
    initErrorHandler,
    destroyErrorHandler,

    // Error handling
    logError,
    logErrorToFirestore,
    getErrorLog,
    clearErrorLog,

    // Error messages
    simplifyErrorMessage,
    getFirebaseErrorMessage,

    // Diagnostics
    generateDiagnosticReport,
    copyDiagnosticReport,

    // UI
    showErrorBoundary,
    hideErrorBoundary,

    // Wrappers
    safeExecute,
    tryCatch,

    // React
    useErrorHandler,
    ErrorBoundary
};
