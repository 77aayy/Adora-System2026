/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * LoadingSkeleton Component - Premium Loading States
 * Beautiful skeleton loaders for better UX
 */

import React from 'react';

interface LoadingSkeletonProps {
    type?: 'card' | 'list' | 'stats' | 'actions';
    count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
    type = 'card', 
    count = 3 
}) => {
    if (type === 'card') {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {Array.from({ length: count }).map((_, i) => (
                    <div
                        key={i}
                        className="adora-card p-4 rounded-xl animate-pulse"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
                        </div>
                        <div className="flex gap-2 mt-4">
                            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex-1" />
                            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-20" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'stats') {
        return (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={i}
                        className="adora-card p-3 sm:p-4 rounded-xl animate-pulse"
                    >
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-200 dark:bg-slate-700" />
                            <div className="flex-1 space-y-2">
                                <div className="h-6 sm:h-8 bg-slate-200 dark:bg-slate-700 rounded w-12" />
                                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (type === 'actions') {
        return (
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex flex-col items-center gap-3 p-4 sm:p-5 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                    >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-200 dark:bg-slate-700" />
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="adora-card p-4 rounded-xl animate-pulse"
                >
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                </div>
            ))}
        </div>
    );
};
