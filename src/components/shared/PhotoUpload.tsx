/**
 * PhotoUpload Component
 * Reusable component for photo capture/upload with preview
 */

import React, { useState, useRef } from 'react';
import { Camera, X, Upload } from 'lucide-react';

interface PhotoUploadProps {
    onPhotoSelect: (file: File) => void;
    onPhotoRemove: () => void;
    preview?: string;
    maxSizeMB?: number;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
    onPhotoSelect,
    onPhotoRemove,
    preview,
    maxSizeMB = 5
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('الرجاء اختيار صورة');
            return;
        }

        // Validate file size
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            setError(`حجم الصورة كبير جداً (حد أقصى ${maxSizeMB}MB)`);
            return;
        }

        setError('');
        onPhotoSelect(file);
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-2">
            {!preview ? (
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        onClick={handleClick}
                        type="button"
                        className="w-full p-6 border-2 border-dashed border-white/20 rounded-xl hover:border-white/40 transition-all bg-white/5 hover:bg-white/10"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                                <Camera className="w-8 h-8 text-white/60" />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-medium">التقط صورة للضرر</p>
                                <p className="text-sm text-white/60 mt-1">اضغط لفتح الكاميرا</p>
                            </div>
                        </div>
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                        onClick={onPhotoRemove}
                        type="button"
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>
            )}

            {error && (
                <p className="text-sm text-red-400">{error}</p>
            )}
        </div>
    );
};
