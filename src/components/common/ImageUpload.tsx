/**
 * Image Upload Component
 * Reusable file upload with progress bar
 * Adora Hotel Management System V2
 */

import React, { useState, useRef } from 'react';
import { Camera, X, CheckCircle, AlertCircle } from 'lucide-react';
import { AdoraLoaderInline } from './AdoraLoader';
import { uploadFile, UploadProgress, formatFileSize } from '../../services/storageService';

// ============================================================
// TYPES
// ============================================================

interface ImageUploadProps {
    /** Storage path for the file */
    path: string;
    /** Callback when upload completes successfully */
    onUploadComplete: (url: string) => void;
    /** Optional callback when upload fails */
    onUploadError?: (error: string) => void;
    /** Label text */
    label?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Accept specific file types */
    accept?: string;
    /** Current value (URL) */
    value?: string;
    /** Disabled state */
    disabled?: boolean;
}

// ============================================================
// COMPONENT
// ============================================================

export const ImageUpload: React.FC<ImageUploadProps> = ({
    path,
    onUploadComplete,
    onUploadError,
    label = 'رفع صورة',
    placeholder = 'اختر صورة أو التقط صورة',
    accept = 'image/*',
    value,
    disabled = false,
}) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(value || null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('يرجى اختيار ملف صورة');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('حجم الملف كبير جداً (الحد الأقصى 5MB)');
            return;
        }

        setUploading(true);
        setError(null);
        setProgress(null);

        const result = await uploadFile(file, path, (p) => {
            setProgress(p);
        });

        setUploading(false);

        if (result.success && result.url) {
            setUploadedUrl(result.url);
            onUploadComplete(result.url);
        } else {
            setError(result.error || 'فشل رفع الصورة');
            onUploadError?.(result.error || 'Upload failed');
        }

        // Reset input
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleRemove = () => {
        setUploadedUrl(null);
        setError(null);
        setProgress(null);
    };

    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-sm text-white/90">{label}</label>
            )}

            {/* Upload Area */}
            {!uploadedUrl && !uploading && (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className={`w-full p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${disabled
                            ? 'border-white/15 text-white/50 cursor-not-allowed'
                            : 'border-white/25 text-white/70 hover:border-primary-500 hover:text-primary-400'
                        }`}
                >
                    <Camera className="w-8 h-8" />
                    <span className="text-sm">{placeholder}</span>
                </button>
            )}

            {/* Progress */}
            {uploading && progress && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                        <AdoraLoaderInline size={20} />
                        <span className="text-sm text-white/90">جاري الرفع...</span> {/* ✅ Improved contrast (was 70%) */}
                        <span className="text-sm text-primary-400 mr-auto">
                            {Math.round(progress.progress)}%
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-primary-500 rounded-full transition-all"
                            style={{ width: `${progress.progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-white/70 mt-1"> {/* ✅ Improved contrast (was 40%) */}
                        {formatFileSize(progress.bytesTransferred)} / {formatFileSize(progress.totalBytes)}
                    </p>
                </div>
            )}

            {/* Uploaded Preview */}
            {uploadedUrl && !uploading && (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                    <img
                        src={uploadedUrl}
                        alt="Uploaded"
                        className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs">تم الرفع</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="w-8 h-8 rounded-lg bg-red-500/80 flex items-center justify-center text-white hover:bg-red-500"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/20 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Hidden Input */}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
                disabled={disabled || uploading}
            />
        </div>
    );
};

export default ImageUpload;
