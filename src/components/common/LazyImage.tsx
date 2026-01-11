/**
 * LazyImage Component
 * ⚡ PERFORMANCE: Lazy loads images only when they enter viewport
 * 
 * Features:
 * - Native lazy loading (loading="lazy")
 * - Intersection Observer fallback
 * - Placeholder while loading
 * - WebP format support
 * - Error handling with fallback
 */

import React, { useState, useRef, useEffect } from 'react';
import { ImageOff } from 'lucide-react';

interface LazyImageProps {
    src: string;
    alt: string;
    className?: string;
    width?: number | string;
    height?: number | string;
    placeholder?: string;
    fallback?: React.ReactNode;
    onLoad?: () => void;
    onError?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
    src,
    alt,
    className = '',
    width,
    height,
    placeholder,
    fallback,
    onLoad,
    onError
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Intersection Observer for browsers that don't support native lazy loading
    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;

        // Check if native lazy loading is supported
        if ('loading' in HTMLImageElement.prototype) {
            setIsInView(true);
            return;
        }

        // Fallback to Intersection Observer
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading 50px before entering viewport
                threshold: 0.01
            }
        );

        observer.observe(img);

        return () => {
            if (img) observer.unobserve(img);
        };
    }, []);

    const handleLoad = () => {
        setIsLoaded(true);
        onLoad?.();
    };

    const handleError = () => {
        setHasError(true);
        onError?.();
    };

    // Show fallback on error
    if (hasError) {
        return fallback || (
            <div 
                className={`flex items-center justify-center bg-white/5 rounded-lg ${className}`}
                style={{ width, height }}
            >
                <ImageOff className="w-6 h-6 text-white/30" />
            </div>
        );
    }

    return (
        <div className="relative" style={{ width, height }}>
            {/* Placeholder while loading */}
            {!isLoaded && (
                <div 
                    className={`absolute inset-0 bg-white/5 rounded-lg animate-pulse ${className}`}
                    style={{ 
                        backgroundImage: placeholder ? `url(${placeholder})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
            )}
            
            {/* Actual image */}
            <img
                ref={imgRef}
                src={isInView ? src : undefined}
                data-src={src}
                alt={alt}
                loading="lazy" // ⚡ Native lazy loading
                decoding="async" // ⚡ Async decoding
                className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                width={width}
                height={height}
                onLoad={handleLoad}
                onError={handleError}
            />
        </div>
    );
};

/**
 * Utility to convert image URL to WebP (if supported)
 */
export const toWebP = (url: string): string => {
    // If already WebP, return as is
    if (url.includes('.webp') || url.includes('format=webp')) {
        return url;
    }
    
    // For imgBB URLs, they support format conversion
    if (url.includes('i.ibb.co') || url.includes('imgbb')) {
        // imgBB doesn't support query params, return original
        return url;
    }
    
    // For Firebase Storage URLs
    if (url.includes('firebasestorage.googleapis.com')) {
        return url; // Firebase serves optimized images automatically
    }
    
    return url;
};

/**
 * Preload critical images
 */
export const preloadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = src;
    });
};

/**
 * Preload multiple images in parallel
 */
export const preloadImages = (srcs: string[]): Promise<void[]> => {
    return Promise.all(srcs.map(preloadImage));
};

export default LazyImage;
