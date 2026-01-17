/**
 * Image Upload Service V3
 * Enterprise-grade image handling with:
 * - WebP conversion for optimal compression
 * - Max 300KB enforcement
 * - Firebase Storage support for tenant isolation
 * - ImgBB fallback for legacy support
 * 
 * Adora Hotel Management System V3
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp, getApp, deleteApp } from 'firebase/app';
import { getImgbbApiKey } from './systemConfigsService';

// ============================================================
// CONFIGURATION
// ============================================================

// ImgBB API - loaded dynamically from system_configs
let IMGBB_API_KEY: string | null = null;
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

// Load ImgBB key from system configs
const loadImgbbKey = async (): Promise<string> => {
    if (!IMGBB_API_KEY) {
        IMGBB_API_KEY = await getImgbbApiKey();
        // ✅ SECURITY FIX: No hardcoded fallback - throw error if not configured
        if (!IMGBB_API_KEY) {
            throw new Error('ImgBB API key not configured. Please set it in System Settings > API Keys.');
        }
    }
    return IMGBB_API_KEY;
};

// ✅ Production Compression Settings
const DEFAULT_MAX_WIDTH = 1200;  // Max width
const DEFAULT_MAX_HEIGHT = 1200; // Max height
const DEFAULT_QUALITY = 0.85;    // Quality (will be reduced if > 300KB)
const MAX_FILE_SIZE_KB = 300;    // ⚠️ STRICT: Max 300KB per image
const UPLOAD_TIMEOUT = 15000;    // 15 seconds

// WebP support check
const WEBP_SUPPORTED = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
})();

// ============================================================
// TYPES
// ============================================================

interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    forceWebP?: boolean;  // ✅ Convert to WebP
    maxSizeKB?: number;   // ✅ Max file size in KB
}

// ✅ Firebase Storage Config for Tenant Isolation
interface TenantStorageConfig {
    storageBucket: string;
    apiKey?: string;
    projectId?: string;
    authDomain?: string;
}

interface UploadResult {
    success: boolean;
    url: string | null;
    thumbUrl?: string | null;
    deleteUrl?: string | null;
    error?: string;
}

interface UploadProgress {
    stage: 'compressing' | 'uploading' | 'complete' | 'error';
    percent: number;
    message: string;
}

type ProgressCallback = (progress: UploadProgress) => void;

// ============================================================
// IMAGE COMPRESSION (WebP + 300KB Enforcement)
// ============================================================

/**
 * ✅ Production-grade image compression
 * - Converts to WebP for optimal compression
 * - Enforces max 300KB file size
 * - Progressively reduces quality until under limit
 */
export const compressImage = async (
    base64Data: string,
    options: CompressionOptions = {}
): Promise<string> => {
    const {
        maxWidth = DEFAULT_MAX_WIDTH,
        maxHeight = DEFAULT_MAX_HEIGHT,
        quality = DEFAULT_QUALITY,
        forceWebP = true, // ✅ Force WebP conversion
        maxSizeKB = MAX_FILE_SIZE_KB // ✅ Max 300KB
    } = options;

    return new Promise((resolve) => {
        const img = new Image();

        img.onload = () => {
            // Calculate new dimensions
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            // Create canvas for compression
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(width);
            canvas.height = Math.round(height);

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(base64Data);
                return;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // ✅ Use WebP if supported, fallback to JPEG
            const outputFormat = (forceWebP && WEBP_SUPPORTED) ? 'image/webp' : 'image/jpeg';
            
            // ✅ Progressive quality reduction to meet size limit
            let currentQuality = quality;
            let compressedData = canvas.toDataURL(outputFormat, currentQuality);
            let iterations = 0;
            const maxIterations = 10;

            // Keep reducing quality until under maxSizeKB
            while (getBase64SizeKB(compressedData) > maxSizeKB && currentQuality > 0.1 && iterations < maxIterations) {
                currentQuality -= 0.1;
                compressedData = canvas.toDataURL(outputFormat, currentQuality);
                iterations++;
            }

            // ✅ If still too large, reduce dimensions
            if (getBase64SizeKB(compressedData) > maxSizeKB) {
                const scaleFactor = Math.sqrt(maxSizeKB / getBase64SizeKB(compressedData));
                canvas.width = Math.round(canvas.width * scaleFactor);
                canvas.height = Math.round(canvas.height * scaleFactor);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                compressedData = canvas.toDataURL(outputFormat, 0.7);
            }

            const originalSize = Math.round(base64Data.length * 0.75 / 1024); // Base64 overhead
            const compressedSize = getBase64SizeKB(compressedData);
            const formatLabel = outputFormat === 'image/webp' ? 'WebP' : 'JPEG';
            
            console.log(`📷 Compressed [${formatLabel}]: ${originalSize}KB → ${compressedSize.toFixed(1)}KB (${Math.round((1 - compressedSize / originalSize) * 100)}% saved) @ Q${Math.round(currentQuality * 100)}`);

            resolve(compressedData);
        };

        img.onerror = () => {
            console.warn('⚠️ Image compression failed, using original');
            resolve(base64Data);
        };
        img.src = base64Data;
    });
};

/**
 * Get base64 string size in KB (accounting for encoding overhead)
 */
const getBase64SizeKB = (base64String: string): number => {
    // Remove data URL prefix if present
    const base64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    // Base64 has ~33% overhead, so actual size is ~75% of string length
    return (base64.length * 0.75) / 1024;
};

/**
 * Convert base64 to Blob for Firebase Storage upload
 */
export const base64ToBlob = (base64Data: string): Blob => {
    const [header, data] = base64Data.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/webp';
    
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

/**
 * Get image dimensions
 */
export const getImageDimensions = (base64Data: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = base64Data;
    });
};

/**
 * Convert File to Base64
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('فشل قراءة الملف'));
        reader.readAsDataURL(file);
    });
};

// ============================================================
// IMAGE UPLOAD
// ============================================================

/**
 * Upload image to ImgBB with compression
 */
export const uploadToImgBB = async (
    base64Data: string,
    name?: string,
    onProgress?: ProgressCallback,
    compressionOptions?: CompressionOptions
): Promise<UploadResult> => {
    try {
        // Stage 1: Compression
        onProgress?.({
            stage: 'compressing',
            percent: 10,
            message: 'جاري ضغط الصورة...'
        });

        const compressedData = await compressImage(base64Data, compressionOptions);

        // Stage 2: Prepare upload
        onProgress?.({
            stage: 'uploading',
            percent: 30,
            message: 'جاري رفع الصورة...'
        });

        // Remove base64 prefix
        let imageData = compressedData;
        if (compressedData.includes(',')) {
            imageData = compressedData.split(',')[1];
        }

        // Load API key dynamically
        const apiKey = await loadImgbbKey();

        // Create FormData
        const formData = new FormData();
        formData.append('key', apiKey);
        formData.append('image', imageData);
        if (name) {
            formData.append('name', name);
        }

        // Upload with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT);

        onProgress?.({
            stage: 'uploading',
            percent: 50,
            message: 'جاري الاتصال بالخادم...'
        });

        const response = await fetch(IMGBB_UPLOAD_URL, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        onProgress?.({
            stage: 'uploading',
            percent: 80,
            message: 'جاري معالجة الاستجابة...'
        });

        const result = await response.json();

        if (result.success) {
            onProgress?.({
                stage: 'complete',
                percent: 100,
                message: 'تم رفع الصورة بنجاح!'
            });

            return {
                success: true,
                url: result.data.display_url || result.data.url,
                thumbUrl: result.data.thumb?.url || result.data.url,
                deleteUrl: result.data.delete_url
            };
        } else {
            onProgress?.({
                stage: 'error',
                percent: 0,
                message: result.error?.message || 'فشل رفع الصورة'
            });

            return {
                success: false,
                url: null,
                error: result.error?.message || 'فشل رفع الصورة'
            };
        }
    } catch (error: any) {
        const errorMessage = error.name === 'AbortError'
            ? 'انتهت مهلة الاتصال'
            : (error.message || 'حدث خطأ أثناء رفع الصورة');

        onProgress?.({
            stage: 'error',
            percent: 0,
            message: errorMessage
        });

        return {
            success: false,
            url: null,
            error: errorMessage
        };
    }
};

/**
 * Upload File object to ImgBB
 */
export const uploadFileToImgBB = async (
    file: File,
    onProgress?: ProgressCallback,
    compressionOptions?: CompressionOptions
): Promise<UploadResult> => {
    try {
        onProgress?.({
            stage: 'compressing',
            percent: 5,
            message: 'جاري قراءة الملف...'
        });

        const base64Data = await fileToBase64(file);
        return uploadToImgBB(base64Data, file.name, onProgress, compressionOptions);
    } catch (error: any) {
        return {
            success: false,
            url: null,
            error: error.message || 'فشل قراءة الملف'
        };
    }
};

// ============================================================
// ✅ FIREBASE STORAGE UPLOAD (Tenant Isolation)
// ============================================================

/**
 * Upload image to Firebase Storage (tenant-specific bucket)
 * ⚠️ This ensures each tenant's images go to THEIR storage, not ours
 * 
 * @param base64Data - Image data
 * @param path - Storage path (e.g., 'rooms/101/photo.webp')
 * @param tenantConfig - Optional tenant-specific Firebase config
 */
export const uploadToFirebaseStorage = async (
    base64Data: string,
    path: string,
    tenantConfig?: TenantStorageConfig,
    onProgress?: ProgressCallback,
    compressionOptions?: CompressionOptions
): Promise<UploadResult> => {
    try {
        // Stage 1: Compression
        onProgress?.({
            stage: 'compressing',
            percent: 10,
            message: 'جاري ضغط وتحويل الصورة لـ WebP...'
        });

        // ✅ Force WebP and 300KB limit
        const compressedData = await compressImage(base64Data, {
            ...compressionOptions,
            forceWebP: true,
            maxSizeKB: MAX_FILE_SIZE_KB
        });

        onProgress?.({
            stage: 'uploading',
            percent: 40,
            message: 'جاري رفع الصورة...'
        });

        let storage;
        let tenantApp: any = null;

        // ✅ Use tenant's storage bucket if provided
        if (tenantConfig?.storageBucket) {
            // Initialize tenant-specific Firebase app
            const tenantAppName = `tenant_storage_${Date.now()}`;
            tenantApp = initializeApp({
                apiKey: tenantConfig.apiKey,
                projectId: tenantConfig.projectId,
                storageBucket: tenantConfig.storageBucket,
                authDomain: tenantConfig.authDomain,
            }, tenantAppName);
            
            storage = getStorage(tenantApp);
            console.log(`📦 Uploading to tenant storage: ${tenantConfig.storageBucket}`);
        } else {
            // Use main app's storage
            storage = getStorage(getApp());
            console.log('📦 Uploading to main storage');
        }

        // Convert base64 to Blob
        const blob = base64ToBlob(compressedData);
        
        // ✅ Ensure path ends with .webp extension
        const finalPath = path.endsWith('.webp') 
            ? path 
            : path.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp') || `${path}.webp`;

        // Create reference and upload
        const storageRef = ref(storage, finalPath);

        onProgress?.({
            stage: 'uploading',
            percent: 60,
            message: 'جاري الحفظ في Firebase Storage...'
        });

        await uploadBytes(storageRef, blob, {
            contentType: 'image/webp',
            customMetadata: {
                uploadedAt: new Date().toISOString(),
                originalSize: `${Math.round(base64Data.length * 0.75 / 1024)}KB`,
                compressedSize: `${Math.round(blob.size / 1024)}KB`
            }
        });

        onProgress?.({
            stage: 'uploading',
            percent: 80,
            message: 'جاري الحصول على رابط التحميل...'
        });

        // Get download URL
        const downloadUrl = await getDownloadURL(storageRef);

        // ✅ Cleanup tenant app
        if (tenantApp) {
            try {
                await deleteApp(tenantApp);
            } catch (e) {
                console.warn('Could not cleanup tenant app:', e);
            }
        }

        onProgress?.({
            stage: 'complete',
            percent: 100,
            message: 'تم رفع الصورة بنجاح!'
        });

        console.log(`✅ Image uploaded: ${Math.round(blob.size / 1024)}KB → ${finalPath}`);

        return {
            success: true,
            url: downloadUrl,
            thumbUrl: downloadUrl // Firebase doesn't auto-generate thumbs
        };

    } catch (error: any) {
        console.error('❌ Firebase Storage upload error:', error);
        
        onProgress?.({
            stage: 'error',
            percent: 0,
            message: error.message || 'فشل رفع الصورة'
        });

        return {
            success: false,
            url: null,
            error: error.message || 'فشل رفع الصورة إلى Firebase Storage'
        };
    }
};

/**
 * Smart upload function - chooses best upload method
 * Priority: Tenant Firebase Storage > Main Firebase Storage > ImgBB
 */
export const smartUpload = async (
    input: File | string,
    options: {
        path?: string;
        name?: string;
        tenantConfig?: TenantStorageConfig;
        preferFirebase?: boolean;
        onProgress?: ProgressCallback;
        compressionOptions?: CompressionOptions;
    } = {}
): Promise<UploadResult> => {
    const { path, name, tenantConfig, preferFirebase = true, onProgress, compressionOptions } = options;

    // Convert File to base64 if needed
    let base64Data: string;
    if (input instanceof File) {
        base64Data = await fileToBase64(input);
    } else {
        base64Data = input;
    }

    // ✅ Route to appropriate storage
    if (preferFirebase && (tenantConfig?.storageBucket || path)) {
        const storagePath = path || `uploads/${Date.now()}_${name || 'image'}.webp`;
        return uploadToFirebaseStorage(base64Data, storagePath, tenantConfig, onProgress, compressionOptions);
    }

    // Fallback to ImgBB
    return uploadToImgBB(base64Data, name, onProgress, compressionOptions);
};

/**
 * Upload multiple images
 */
export const uploadMultipleImages = async (
    files: File[],
    onProgress?: (index: number, total: number, result: UploadResult) => void,
    compressionOptions?: CompressionOptions
): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
        const result = await uploadFileToImgBB(files[i], undefined, compressionOptions);
        results.push(result);
        onProgress?.(i + 1, files.length, result);
    }

    return results;
};

// ============================================================
// CAMERA CAPTURE
// ============================================================

/**
 * Capture photo from camera
 */
export const capturePhoto = async (
    facingMode: 'user' | 'environment' = 'environment'
): Promise<string | null> => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode }
        });

        // Create video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        // Small delay to ensure video is playing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);

        // Stop camera
        stream.getTracks().forEach(track => track.stop());

        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
        console.error('Camera capture error:', error);
        return null;
    }
};

/**
 * Check if camera is available
 */
export const isCameraAvailable = async (): Promise<boolean> => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'videoinput');
    } catch {
        return false;
    }
};

// ============================================================
// VALIDATION
// ============================================================

/**
 * Validate image file
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'نوع الملف غير مدعوم. الأنواع المدعومة: JPEG, PNG, GIF, WebP' };
    }

    if (file.size > maxSize) {
        return { valid: false, error: 'حجم الملف كبير جداً. الحد الأقصى: 10MB' };
    }

    return { valid: true };
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

interface UseImageUploadState {
    uploading: boolean;
    progress: UploadProgress | null;
    result: UploadResult | null;
    error: string | null;
}

export const useImageUpload = () => {
    const [state, setState] = useState<UseImageUploadState>({
        uploading: false,
        progress: null,
        result: null,
        error: null
    });

    const upload = useCallback(async (
        input: File | string,
        name?: string,
        compressionOptions?: CompressionOptions
    ): Promise<UploadResult> => {
        setState({
            uploading: true,
            progress: null,
            result: null,
            error: null
        });

        const onProgress = (progress: UploadProgress) => {
            setState(prev => ({ ...prev, progress }));
        };

        let result: UploadResult;

        if (input instanceof File) {
            result = await uploadFileToImgBB(input, onProgress, compressionOptions);
        } else {
            result = await uploadToImgBB(input, name, onProgress, compressionOptions);
        }

        setState({
            uploading: false,
            progress: result.success
                ? { stage: 'complete', percent: 100, message: 'تم!' }
                : { stage: 'error', percent: 0, message: result.error || 'خطأ' },
            result,
            error: result.error || null
        });

        return result;
    }, []);

    const reset = useCallback(() => {
        setState({
            uploading: false,
            progress: null,
            result: null,
            error: null
        });
    }, []);

    return {
        ...state,
        upload,
        reset
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Compression
    compressImage,
    getImageDimensions,
    fileToBase64,

    // Upload
    uploadToImgBB,
    uploadFileToImgBB,
    uploadMultipleImages,

    // Camera
    capturePhoto,
    isCameraAvailable,

    // Validation
    validateImageFile,

    // Hook
    useImageUpload
};
