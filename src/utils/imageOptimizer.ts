/**
 * Image Optimizer
 * Utilities for optimizing images
 * Adora Hotel Management System V3
 */

// ============================================================
// IMAGE COMPRESSION
// ============================================================

export interface ImageOptimizationOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0-1
    format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Compress image file
 */
export async function compressImage(
    file: File,
    options: ImageOptimizationOptions = {}
): Promise<File> {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.8,
        format = 'image/jpeg',
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        const compressedFile = new File([blob], file.name, {
                            type: format,
                            lastModified: Date.now(),
                        });

                        resolve(compressedFile);
                    },
                    format,
                    quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));

            if (typeof e.target?.result === 'string') {
                img.src = e.target.result;
            } else {
                reject(new Error('Invalid file data'));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));

        reader.readAsDataURL(file);
    });
}

/**
 * Get image dimensions without loading full image
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.width, height: img.height });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Check if image needs compression
 */
export async function shouldCompressImage(
    file: File,
    maxSizeMB: number = 1
): Promise<boolean> {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size > maxSizeBytes;
}

// ============================================================
// LAZY IMAGE LOADING
// ============================================================

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(baseUrl: string, widths: number[] = [400, 800, 1200]): string {
    return widths.map((width) => `${baseUrl}?w=${width} ${width}w`).join(', ');
}

/**
 * Generate sizes attribute for responsive images
 */
export function generateSizes(breakpoints: { [key: string]: string }): string {
    return Object.entries(breakpoints)
        .map(([media, size]) => `(${media}) ${size}`)
        .join(', ');
}
