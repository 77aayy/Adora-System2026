/**
 * Skeleton Loader Component
 * Beautiful loading placeholders instead of spinners
 * Adora Hotel Management System V2
 */

import React from 'react';

interface SkeletonLoaderProps {
    type?: 'card' | 'text' | 'avatar' | 'button' | 'list' | 'table' | 'grid';
    count?: number;
    className?: string;
    width?: string;
    height?: string;
    rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
};

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    type = 'card',
    count = 1,
    className = '',
    width,
    height,
    rounded = 'lg',
}) => {
    const baseClasses = `skeleton bg-white/5 animate-shimmer ${roundedClasses[rounded]}`;

    const renderSkeleton = () => {
        switch (type) {
            case 'card':
                return (
                    <div className={`${baseClasses} p-4 space-y-3 ${className}`}>
                        <div className={`${baseClasses} h-6 w-3/4`} />
                        <div className={`${baseClasses} h-4 w-full`} />
                        <div className={`${baseClasses} h-4 w-2/3`} />
                    </div>
                );

            case 'text':
                return (
                    <div className={`space-y-2 ${className}`}>
                        {Array.from({ length: count }).map((_, i) => (
                            <div
                                key={i}
                                className={`${baseClasses} h-4 ${i === count - 1 ? 'w-2/3' : 'w-full'}`}
                                style={width || height ? { width, height } : undefined}
                            />
                        ))}
                    </div>
                );

            case 'avatar':
                return (
                    <div
                        className={`${baseClasses} ${className}`}
                        style={{
                            width: width || '48px',
                            height: height || '48px',
                        }}
                    />
                );

            case 'button':
                return (
                    <div
                        className={`${baseClasses} ${className}`}
                        style={{
                            width: width || '120px',
                            height: height || '40px',
                        }}
                    />
                );

            case 'list':
                return (
                    <div className={`space-y-3 ${className}`}>
                        {Array.from({ length: count }).map((_, i) => (
                            <div key={i} className={`${baseClasses} p-4 flex items-center gap-3`}>
                                <div className={`${baseClasses} w-12 h-12 ${roundedClasses.full}`} />
                                <div className="flex-1 space-y-2">
                                    <div className={`${baseClasses} h-4 w-3/4`} />
                                    <div className={`${baseClasses} h-3 w-1/2`} />
                                </div>
                            </div>
                        ))}
                    </div>
                );

            case 'table':
                return (
                    <div className={`space-y-3 ${className}`}>
                        {Array.from({ length: count }).map((_, i) => (
                            <div key={i} className={`${baseClasses} p-4 grid grid-cols-4 gap-4`}>
                                <div className={`${baseClasses} h-4`} />
                                <div className={`${baseClasses} h-4`} />
                                <div className={`${baseClasses} h-4`} />
                                <div className={`${baseClasses} h-4`} />
                            </div>
                        ))}
                    </div>
                );

            case 'grid':
                return (
                    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
                        {Array.from({ length: count }).map((_, i) => (
                            <div key={i} className={`${baseClasses} p-4 space-y-3`}>
                                <div className={`${baseClasses} h-24 w-full`} />
                                <div className={`${baseClasses} h-4 w-3/4`} />
                                <div className={`${baseClasses} h-3 w-1/2`} />
                            </div>
                        ))}
                    </div>
                );

            default:
                return (
                    <div
                        className={`${baseClasses} ${className}`}
                        style={{ width: width || '100%', height: height || '20px' }}
                    />
                );
        }
    };

    return <>{renderSkeleton()}</>;
};

/**
 * Request Card Skeleton (specific for request cards)
 */
export const RequestCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
    return (
        <div className="space-y-3 animate-fade-in">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="glass-card p-4 space-y-3 skeleton animate-shimmer"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    <div className="flex items-center justify-between">
                        <div className="skeleton bg-white/5 h-5 w-32 rounded-lg" />
                        <div className="skeleton bg-white/5 h-6 w-20 rounded-full" />
                    </div>
                    <div className="skeleton bg-white/5 h-4 w-full rounded-lg" />
                    <div className="skeleton bg-white/5 h-4 w-2/3 rounded-lg" />
                    <div className="flex gap-2 mt-3">
                        <div className="skeleton bg-white/5 h-8 w-20 rounded-lg" />
                        <div className="skeleton bg-white/5 h-8 w-20 rounded-lg" />
                    </div>
                </div>
            ))}
        </div>
    );
};

/**
 * Dashboard Stats Skeleton
 */
export const StatsSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="glass-card p-4 space-y-3 skeleton animate-shimmer"
                    style={{ animationDelay: `${i * 100}ms` }}
                >
                    <div className="skeleton bg-white/5 h-8 w-8 rounded-lg" />
                    <div className="skeleton bg-white/5 h-6 w-16 rounded-lg" />
                    <div className="skeleton bg-white/5 h-4 w-24 rounded-lg" />
                </div>
            ))}
        </div>
    );
};

export default SkeletonLoader;
