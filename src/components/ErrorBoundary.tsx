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

        const errorDetails = `
Error: ${error.toString()}
Stack: ${errorInfo?.componentStack || 'No stack available'}
URL: ${window.location.href}
Time: ${new Date().toISOString()}
        `.trim();

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

            // Default fallback UI
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
                    <div className="max-w-md w-full glass p-8 rounded-2xl text-center">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            حدث خطأ غير متوقع
                        </h1>

                        <p className="text-white/60 mb-6">
                            نعتذر عن هذا الإزعاج. حدث خطأ أثناء تحميل هذه الصفحة.
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-slate-800/50 rounded-lg p-4 mb-6 text-left">
                                {/* Smart Friendly Message */}
                                <div className="mb-3 pb-3 border-b border-white/5">
                                    <p className="text-orange-400 text-sm font-bold flex items-center gap-2 mb-1">
                                        <Sparkles className="w-4 h-4" />
                                        المساعد الذكي:
                                    </p>
                                    <p className="text-white/80 text-sm">
                                        {getFriendlyErrorMessage(this.state.error.toString())}
                                    </p>
                                </div>

                                <p className="text-red-400 text-sm font-mono mb-2 dir-ltr">
                                    {this.state.error.toString()}
                                </p>
                                {this.state.errorInfo && (
                                    <pre className="text-white/40 text-xs overflow-auto max-h-32 dir-ltr">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                )}

                                {/* ✅ Copy Button */}
                                <button
                                    onClick={this.handleCopyError}
                                    className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all
                                        ${this.state.copied
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5 hover:border-white/20'
                                        }
                                    `}
                                >
                                    {this.state.copied ? (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            تم النسخ بنجاح
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            نسخ تفاصيل الخطأ لإرسالها للمطور
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center flex-wrap">
                            <button
                                onClick={this.handleReset}
                                className="btn-primary flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                إعادة المحاولة
                            </button>

                            <button
                                onClick={this.handleReload}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                تحديث الصفحة
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="btn-secondary flex items-center gap-2"
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
