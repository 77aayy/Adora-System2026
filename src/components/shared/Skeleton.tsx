/**
 * Skeleton Loading Components
 * Adora Hotel Management System V2
 */

import React from 'react';
import './Skeleton.css';

// ============================================================
// BASE SKELETON
// ============================================================

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string;
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = '1rem',
    borderRadius = '4px',
    className = '',
}) => (
    <div
        className={`skeleton ${className}`}
        style={{
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
            borderRadius,
        }}
    />
);

// ============================================================
// SKELETON VARIANTS
// ============================================================

/**
 * Skeleton for text lines
 */
export const SkeletonText: React.FC<{
    lines?: number;
    lastLineWidth?: string;
}> = ({ lines = 3, lastLineWidth = '60%' }) => (
    <div className="skeleton-text">
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
                key={i}
                width={i === lines - 1 ? lastLineWidth : '100%'}
                height="0.875rem"
                className="skeleton-line"
            />
        ))}
    </div>
);

/**
 * Skeleton for avatars/profile pics
 */
export const SkeletonAvatar: React.FC<{
    size?: number;
}> = ({ size = 40 }) => (
    <Skeleton width={size} height={size} borderRadius="50%" />
);

/**
 * Skeleton for cards
 */
export const SkeletonCard: React.FC<{
    hasImage?: boolean;
    hasAvatar?: boolean;
}> = ({ hasImage = false, hasAvatar = false }) => (
    <div className="skeleton-card">
        {hasImage && (
            <Skeleton height={160} borderRadius="8px 8px 0 0" />
        )}
        <div className="skeleton-card-content">
            {hasAvatar && (
                <div className="skeleton-card-header">
                    <SkeletonAvatar size={48} />
                    <div className="skeleton-card-meta">
                        <Skeleton width="60%" height="1rem" />
                        <Skeleton width="40%" height="0.75rem" />
                    </div>
                </div>
            )}
            <SkeletonText lines={3} />
        </div>
    </div>
);

/**
 * Skeleton for request cards (Adora specific)
 */
export const SkeletonRequestCard: React.FC = () => (
    <div className="skeleton-request-card">
        <div className="skeleton-request-header">
            <Skeleton width={60} height={24} borderRadius="4px" />
            <Skeleton width={80} height={20} borderRadius="12px" />
        </div>
        <div className="skeleton-request-body">
            <Skeleton width="70%" height="1rem" />
            <Skeleton width="50%" height="0.875rem" />
        </div>
        <div className="skeleton-request-footer">
            <Skeleton width={100} height={32} borderRadius="6px" />
            <Skeleton width={100} height={32} borderRadius="6px" />
        </div>
    </div>
);

/**
 * Skeleton for table rows
 */
export const SkeletonTable: React.FC<{
    rows?: number;
    columns?: number;
}> = ({ rows = 5, columns = 4 }) => (
    <div className="skeleton-table">
        <div className="skeleton-table-header">
            {Array.from({ length: columns }).map((_, i) => (
                <Skeleton key={i} width="100%" height="1rem" />
            ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="skeleton-table-row">
                {Array.from({ length: columns }).map((_, colIndex) => (
                    <Skeleton key={colIndex} width="100%" height="0.875rem" />
                ))}
            </div>
        ))}
    </div>
);

/**
 * Skeleton for dashboard stats
 */
export const SkeletonStats: React.FC = () => (
    <div className="skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-stat-card">
                <Skeleton width={40} height={40} borderRadius="8px" />
                <div className="skeleton-stat-content">
                    <Skeleton width="40%" height="0.75rem" />
                    <Skeleton width="60%" height="1.5rem" />
                </div>
            </div>
        ))}
    </div>
);

export default Skeleton;
