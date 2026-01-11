/**
 * Error Boundary Component
 * Catches and displays errors gracefully
 * Adora Hotel Management System V2
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { haptic, playSound } from '../../utils/uxEffects';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
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
        
        console.error('Error caught by boundary:', error, errorInfo);
        
        this.setState({
            error,
            errorInfo,
        });

        // Haptic and sound feedback
        haptic('error');
        playSound('error');

        // Call custom error handler
        this.props.onError?.(error, errorInfo);

        // Log to error reporting service (if available)
        // logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
        haptic('light');
        playSound('click');
    };

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const { error, errorInfo } = this.state;

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
                    <div className="glass-card max-w-md w-full p-8 rounded-3xl text-center animate-fade-in-up">
                        {/* Icon */}
                        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 animate-bounce-in">
                            <AlertTriangle className="w-10 h-10 text-red-400" />
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-bold text-white mb-3">حدث خطأ غير متوقع</h1>

                        {/* Message */}
                        <p className="text-white/60 mb-6 leading-relaxed">
                            عذراً، حدث خطأ أثناء تحميل هذه الصفحة. يرجى المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
                        </p>

                        {/* Error Details (Development Only) */}
                        {process.env.NODE_ENV === 'development' && error && (
                            <details className="mb-6 text-right">
                                <summary className="text-sm text-white/40 cursor-pointer mb-2">
                                    تفاصيل الخطأ (للنظام فقط)
                                </summary>
                                <div className="bg-red-500/10 p-4 rounded-lg text-sm text-red-400 font-mono overflow-auto max-h-40">
                                    <div className="mb-2 font-bold">Error:</div>
                                    <div className="mb-4">{error.toString()}</div>
                                    {errorInfo && (
                                        <>
                                            <div className="mb-2 font-bold">Stack:</div>
                                            <div className="text-xs">{errorInfo.componentStack}</div>
                                        </>
                                    )}
                                </div>
                            </details>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 px-6 py-3 rounded-xl bg-primary-500/20 text-primary-400 border border-primary-500/30 hover:bg-primary-500/30 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
                            >
                                <RefreshCw className="w-4 h-4" />
                                إعادة المحاولة
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 px-6 py-3 rounded-xl bg-white/10 text-white/80 border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
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

export default ErrorBoundary;
