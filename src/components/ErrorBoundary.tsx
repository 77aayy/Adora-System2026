/**
 * Error Boundary Component
 * Prevents full app crashes from component errors
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Sparkles, Copy, Check } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    copied: boolean; // ✅ State for copy feedback
}

// Helper to translate technical errors to friendly Arabic
const getFriendlyErrorMessage = (errorStr: string): string => {
    const err = errorStr.toLowerCase();

    if (err.includes('not defined') || err.includes('referenceerror')) {
        return "يبدو أن هناك ملفاً مفقوداً أو مكوناً لم يتم استيراده بشكل صحيح. (تأكد من وجود الملفات)";
    }
    if (err.includes('properties of undefined') || err.includes('properties of null')) {
        return "حاول النظام قراءة بيانات غير موجودة. قد تكون البيانات لم تحمل بعد.";
    }
    if (err.includes('import') || err.includes('loading chunk')) {
        return "فشل تحميل الملفات. تأكد من اتصال الانترنت أو حاول تحديث الصفحة.";
    }
    if (err.includes('minified react error')) {
        return "حدث خطأ عام في النظام. يرجى مراجعة الدعم الفني.";
    }

    return "حدث خطأ غير متوقع. حاول إعادة المحاولة.";
};

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            copied: false
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
            copied: false
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // ✅ Check if it's a chunk loading error (dynamic import failure)
        const isChunkError = error.message?.includes('Failed to fetch dynamically imported module') ||
                            error.message?.includes('Loading chunk') ||
                            error.message?.includes('ChunkLoadError');
        
        if (isChunkError) {
            console.warn('⚠️ Chunk loading error - reloading page:', error.message);
            // ✅ For chunk errors, reload immediately without showing error screen
            window.location.reload();
            return;
        }
        
        // Log error to console (could send to error tracking service)
        console.error('Error Boundary caught error:', error, errorInfo);

        this.setState({
            error,
            errorInfo
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    handleReload = () => {
        // ✅ Clear error state from localStorage and reload
        localStorage.removeItem('adora_errors');
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    handleCopyError = async () => {
        const { error, errorInfo } = this.state;
        if (!error) return;

        // ✅ Extract only the essential error information (file path, line number, error message)
        const errorMessage = error.toString();
        
        // Extract file path and line number from error message (e.g., "C:\path\to\file.tsx:1080:16")
        const filePathMatch = errorMessage.match(/([A-Z]:[^:]+):(\d+):(\d+)/i) || 
                             errorMessage.match(/([^:]+\.(tsx?|jsx?)):(\d+):(\d+)/i);
        
        // Extract the main error message (usually after the file path or in parentheses)
        const mainErrorMatch = errorMessage.match(/Expected corresponding JSX closing tag|Unexpected token|Cannot read|is not defined|Cannot find/i);
        const mainError = mainErrorMatch ? mainErrorMatch[0] : errorMessage.split('\n')[0].trim();
        
        // Build concise error details (only what Cursor needs to understand quickly)
        const errorDetails = filePathMatch
            ? `${filePathMatch[1]}:${filePathMatch[2]}:${filePathMatch[3] || filePathMatch[4]}\n${mainError}`
            : `${mainError}\n${errorMessage.split('\n')[0]}`;

        try {
            await navigator.clipboard.writeText(errorDetails);
            this.setState({ copied: true });
            setTimeout(() => this.setState({ copied: false }), 2000);
        } catch (err) {
            console.error('Failed to copy error:', err);
        }
    };

    render() {
        if (this.state.hasError) {
            // Custom fallback UI
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI - Adora Theme (Proper Colors)
            return (
                <div 
                    className="min-h-screen flex items-center justify-center p-4"
                    style={{ background: 'var(--theme-gradient-page)' }}
                >
                    <div 
                        className="max-w-2xl w-full rounded-3xl p-6 sm:p-8 text-center shadow-2xl"
                        style={{
                            background: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border-primary)',
                            boxShadow: 'var(--theme-shadow-card)'
                        }}
                    >
                        <div 
                            className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
                            style={{
                                background: 'var(--theme-accent-red-light)',
                            }}
                        >
                            <AlertTriangle 
                                className="w-8 h-8" 
                                style={{ color: 'var(--theme-accent-red)' }}
                            />
                        </div>

                        <h1 
                            className="text-2xl font-bold mb-2"
                            style={{ color: 'var(--theme-text-primary)' }}
                        >
                            حدث خطأ غير متوقع
                        </h1>

                        <p 
                            className="mb-6"
                            style={{ color: 'var(--theme-text-secondary)' }}
                        >
                            نعتذر عن هذا الإزعاج. حدث خطأ أثناء تحميل هذه الصفحة.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div 
                                className="rounded-xl p-5 mb-6 text-left"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                            >
                                {/* Smart Friendly Message */}
                                <div 
                                    className="mb-4 pb-4"
                                    style={{ borderBottom: '1px solid var(--theme-border-primary)' }}
                                >
                                    <p 
                                        className="text-sm font-bold flex items-center gap-2 mb-2"
                                        style={{ color: 'var(--theme-primary-600)' }}
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        المساعد الذكي:
                                    </p>
                                    <p 
                                        className="text-sm leading-relaxed"
                                        style={{ color: 'var(--theme-text-secondary)' }}
                                    >
                                        {getFriendlyErrorMessage(this.state.error.toString())}
                                    </p>
                                </div>

                                {/* Main Error - Highlighted */}
                                <div className="mb-4">
                                    <p 
                                        className="text-xs mb-2 font-medium"
                                        style={{ color: 'var(--theme-text-tertiary)' }}
                                    >
                                        الخطأ الأساسي:
                                    </p>
                                    <div 
                                        className="rounded-lg p-3 font-mono text-sm dir-ltr text-left"
                                        style={{
                                            background: 'var(--theme-accent-red-light)',
                                            border: '1px solid var(--theme-accent-red)',
                                            color: 'var(--theme-accent-red-dark)'
                                        }}
                                    >
                                        {(() => {
                                            const errorMsg = this.state.error.toString();
                                            // Extract file path and line number
                                            const fileMatch = errorMsg.match(/([A-Z]:[^:]+):(\d+):(\d+)/i) || 
                                                             errorMsg.match(/([^:]+\.(tsx?|jsx?)):(\d+):(\d+)/i);
                                            // Extract main error type
                                            const mainError = errorMsg.match(/Expected corresponding JSX closing tag|Unexpected token|Cannot read|is not defined|Cannot find/i)?.[0] || 
                                                            errorMsg.split('\n')[0].trim();
                                            
                                            if (fileMatch) {
                                                return `${fileMatch[1]}:${fileMatch[2]}:${fileMatch[3] || fileMatch[4]}\n${mainError}`;
                                            }
                                            return mainError;
                                        })()}
                                    </div>
                                </div>

                                {/* Stack Trace - Collapsible (Hidden by default) */}
                                {this.state.errorInfo && (
                                    <details className="mb-4">
                                        <summary 
                                            className="text-xs cursor-pointer mb-2"
                                            style={{ color: 'var(--theme-text-tertiary)' }}
                                        >
                                            عرض تفاصيل إضافية (Stack Trace)
                                        </summary>
                                        <pre 
                                            className="text-xs overflow-auto max-h-40 dir-ltr text-left rounded-lg p-3 mt-2"
                                            style={{
                                                background: 'var(--theme-bg-primary)',
                                                border: '1px solid var(--theme-border-primary)',
                                                color: 'var(--theme-text-tertiary)'
                                            }}
                                        >
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    </details>
                                )}

                                {/* ✅ Copy Button - Adora Theme */}
                                <button
                                    onClick={this.handleCopyError}
                                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
                                    style={{
                                        background: this.state.copied 
                                            ? 'var(--theme-accent-green)' 
                                            : 'var(--theme-primary-600)',
                                        color: 'white',
                                        border: 'none',
                                        boxShadow: this.state.copied 
                                            ? 'var(--theme-shadow-md)' 
                                            : 'var(--theme-shadow-sm)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!this.state.copied) {
                                            e.currentTarget.style.background = 'var(--theme-primary-700)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!this.state.copied) {
                                            e.currentTarget.style.background = 'var(--theme-primary-600)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }
                                    }}
                                >
                                    {this.state.copied ? (
                                        <>
                                            <Check className="w-4 h-4" />
                                            تم النسخ بنجاح
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            نسخ تفاصيل الخطأ
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center flex-wrap">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all"
                                style={{
                                    background: 'var(--theme-primary-600)',
                                    color: 'white',
                                    border: 'none',
                                    boxShadow: 'var(--theme-shadow-sm)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--theme-primary-700)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--theme-primary-600)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <RefreshCw className="w-4 h-4" />
                                إعادة المحاولة
                            </button>

                            <button
                                onClick={this.handleReload}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    color: 'var(--theme-text-primary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--theme-bg-secondary)';
                                    e.currentTarget.style.borderColor = 'var(--theme-border-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                    e.currentTarget.style.borderColor = 'var(--theme-border-primary)';
                                }}
                            >
                                <RefreshCw className="w-4 h-4" />
                                تحديث الصفحة
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    color: 'var(--theme-text-primary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--theme-bg-secondary)';
                                    e.currentTarget.style.borderColor = 'var(--theme-border-hover)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--theme-bg-tertiary)';
                                    e.currentTarget.style.borderColor = 'var(--theme-border-primary)';
                                }}
                            >
                                <Home className="w-4 h-4" />
                                الصفحة الرئيسية
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
