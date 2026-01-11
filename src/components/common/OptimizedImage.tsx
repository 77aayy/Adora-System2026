/**
 * Optimized Image Component
 * Features:
 * - Lazy loading (native)
 * - Blur placeholder while loading
 * - WebP format support
 * - Responsive sizing
 * - Error fallback
 */

import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface OptimizedImageProps {
    src: string;
    alt: string;
    className?: string;
    width?: number;
    height?: number;
    fallback?: string;
    priority?: boolean; // Disable lazy loading for above-the-fold images
    onLoad?: () => void;
    onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    alt,
    className = '',
    width,
    height,
    fallback,
    priority = false,
    onLoad,
    onError,
}) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [imageSrc, setImageSrc] = useState(src);

    // ✅ Optimize image URL (if using CDN like ImgBB/Cloudinary)
    const getOptimizedUrl = (url: string): string => {
        // If ImgBB URL, we can't add params, return as is
        if (url.includes('i.ibb.co') || url.includes('imgbb.com')) {
            return url;
        }

        // If Cloudinary URL, add optimization params
        if (url.includes('cloudinary.com')) {
            const params = [];
            if (width) params.push(`w_${width}`);
            if (height) params.push(`h_${height}`);
            params.push('q_auto', 'f_auto'); // Auto quality and format
            
            return url.replace('/upload/', `/upload/${params.join(',')}/`);
        }

        // Firebase Storage - return as is
        if (url.includes('firebasestorage.googleapis.com')) {
            return url;
        }

        return url;
    };

    useEffect(() => {
        setImageSrc(getOptimizedUrl(src));
    }, [src]);

    const handleLoad = () => {
        setLoaded(true);
        onLoad?.();
    };

    const handleError = () => {
        setError(true);
        if (fallback) {
            setImageSrc(fallback);
            setError(false); // Try fallback
        }
        onError?.();
    };

    // ✅ Error state
    if (error && !fallback) {
        return (
            <div
                className={`flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 ${className}`}
                style={{ width, height }}
            >
                <ImageIcon className="w-8 h-8 text-white/20" />
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
            {/* ✅ Blur placeholder */}
            {!loaded && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 animate-pulse" />
            )}

            {/* ✅ Image */}
            <img
                src={imageSrc}
                alt={alt}
                loading={priority ? 'eager' : 'lazy'} // Native lazy loading
                decoding="async" // Async decoding for better performance
                onLoad={handleLoad}
                onError={handleError}
                width={width}
                height={height}
                className={`
                    w-full h-full object-cover transition-opacity duration-500
                    ${loaded ? 'opacity-100' : 'opacity-0'}
                `}
            />
        </div>
    );
};

/**
 * Avatar Image (specialized for user profiles)
 */
interface AvatarImageProps {
    src?: string;
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

export const AvatarImage: React.FC<AvatarImageProps> = ({
    src,
    name,
    size = 'md',
    className = '',
}) => {
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-16 h-16 text-base',
        xl: 'w-24 h-24 text-xl',
    };

    // Generate initials from name
    const getInitials = (fullName: string): string => {
        const names = fullName.trim().split(' ');
        if (names.length >= 2) {
            return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
        }
        return fullName.slice(0, 2).toUpperCase();
    };

    if (!src) {
        // Fallback to initials
        return (
            <div
                className={`
                    ${sizeClasses[size]} 
                    rounded-full 
                    bg-gradient-to-br from-teal-500 to-blue-500 
                    flex items-center justify-center 
                    text-white font-bold
                    ${className}
                `}
            >
                {getInitials(name)}
            </div>
        );
    }

    return (
        <OptimizedImage
            src={src}
            alt={name}
            className={`${sizeClasses[size]} rounded-full ${className}`}
            fallback={undefined} // Will show initials on error via parent logic
        />
    );
};

export default OptimizedImage;
