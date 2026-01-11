/**
 * Storage Service
 * Using ImgBB for image storage (not Firebase Storage)
 * Adora Hotel Management System V2
 * 
 * ✅ Uploads to ImgBB for:
 *    - Free storage
 *    - Faster loading
 *    - Image compression
 */

import { uploadToImgBB, uploadFileToImgBB, compressImage, fileToBase64 } from './imageUploadService';

// ============================================================
// TYPES
// ============================================================

export interface UploadProgress {
    progress: number;
    state: 'running' | 'paused' | 'success' | 'error';
    bytesTransferred: number;
    totalBytes: number;
}

export interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

// ============================================================
// UPLOAD FUNCTIONS (Using ImgBB)
// ============================================================

/**
 * Upload a file to ImgBB (not Firebase Storage)
 * @param file - The file to upload
 * @param path - Storage path (used for naming only)
 * @param onProgress - Optional progress callback
 * @returns Promise with download URL
 */
export const uploadFile = async (
    file: File,
    path: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
    try {
        // Convert progress callback
        const imgbbProgress = (p: { stage: string; percent: number }) => {
            onProgress?.({
                progress: p.percent,
                state: p.stage === 'complete' ? 'success' : 'running',
                bytesTransferred: Math.floor((p.percent / 100) * file.size),
                totalBytes: file.size,
            });
        };

        // Upload to ImgBB with compression
        const result = await uploadFileToImgBB(file, imgbbProgress, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.7
        });

        if (result.success && result.url) {
            return {
                success: true,
                url: result.url,
            };
        } else {
            return {
                success: false,
                error: result.error || 'Upload failed',
            };
        }
    } catch (error: any) {
        console.error('Upload error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Upload maintenance photo (before/after) to ImgBB
 */
export const uploadMaintenancePhoto = async (
    file: File,
    requestId: string,
    type: 'before' | 'after',
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
    // Upload to ImgBB with path info in filename
    return uploadFile(file, `maintenance/${requestId}/${type}`, onProgress);
};

/**
 * Upload inspection photo (damage report) to ImgBB
 */
export const uploadInspectionPhoto = async (
    file: File | string, // Can be File or base64 string
    requestId: string,
    onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
    try {
        let result;

        if (typeof file === 'string') {
            // It's a base64 string
            const imgbbProgress = (p: { stage: string; percent: number }) => {
                onProgress?.({
                    progress: p.percent,
                    state: p.stage === 'complete' ? 'success' : 'running',
                    bytesTransferred: 0,
                    totalBytes: 0,
                });
            };

            result = await uploadToImgBB(file, `inspection_${requestId}`, imgbbProgress, {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.7
            });
        } else {
            // It's a File object
            result = await uploadFile(file, `inspections/${requestId}/damage`, onProgress);
            return result;
        }

        if (result.success && result.url) {
            return {
                success: true,
                url: result.url,
            };
        } else {
            return {
                success: false,
                error: result.error || 'Upload failed',
            };
        }
    } catch (error: any) {
        console.error('Inspection upload error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Get file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
