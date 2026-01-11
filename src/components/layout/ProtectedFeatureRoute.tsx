/**
 * Protected Feature Route
 * ✅ CRITICAL: Use this to protect routes that require specific features
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFeatureGate } from '../../hooks/useFeatureGate';

interface ProtectedFeatureRouteProps {
    feature: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const ProtectedFeatureRoute: React.FC<ProtectedFeatureRouteProps> = ({
    feature,
    children,
    fallback
}) => {
    const { isEnabled, loading, error } = useFeatureGate(feature);

    if (loading) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto mb-4" />
                    <p className="text-white/60">جاري التحقق من الميزة...</p>
                </div>
            </div>
        );
    }

    if (!isEnabled) {
        if (fallback) {
            return <>{fallback}</>;
        }

        return (
            <div className="min-h-screen theme-page flex items-center justify-center p-4">
                <div className="max-w-md w-full glass rounded-3xl p-8 text-center border-t border-amber-500/20">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold text-white mb-2">
                        الميزة غير متاحة
                    </h1>

                    <p className="text-white/60 mb-8 leading-relaxed">
                        {error || 'هذه الميزة غير متاحة في خطتك الحالية أو الترخيص غير نشط.'}
                    </p>

                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold transition-colors"
                    >
                        العودة
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
