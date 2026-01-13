/**
 * Maintenance Complete Modal
 * For completing maintenance requests with evidence
 * Adora Hotel Management System V2
 */

import React, { useState, useRef } from 'react';
import {
    X,
    CheckCircle,
    Camera,
    Wrench,
    RefreshCw,
    Star,
    Package,
    Zap,
    Droplets,
    Wind,
    Sofa,
    MoreHorizontal,
    Upload,
    Image as ImageIcon,
    Loader2,
} from 'lucide-react';
import { Request, MaintenanceReport } from '../../types';
import {
    calculateMaintenancePoints,
    getMaintenanceTypeLabel,
    MaintenanceType,
} from '../../utils/pointsCalculator';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { uploadFileToImgBB, validateImageFile } from '../../services/imageUploadService';

// ============================================================
// TYPES
// ============================================================

interface MaintenanceCompleteModalProps {
    isOpen: boolean;
    request: Request;
    onClose: () => void;
    onSubmit: (report: MaintenanceReport) => Promise<void>;
}

// Category icons
const CATEGORY_ICONS: Record<MaintenanceType, React.ReactNode> = {
    electrical: <Zap className="w-5 h-5" />,
    plumbing: <Droplets className="w-5 h-5" />,
    ac: <Wind className="w-5 h-5" />,
    furniture: <Sofa className="w-5 h-5" />,
    other: <MoreHorizontal className="w-5 h-5" />,
};

// ============================================================
// COMPONENT
// ============================================================

export const MaintenanceCompleteModal: React.FC<MaintenanceCompleteModalProps> = ({
    isOpen,
    request,
    onClose,
    onSubmit,
}) => {
    const maintenanceType = ((request.details as any)?.maintenanceCategory || 'other') as MaintenanceType;

    const [formData, setFormData] = useState({
        description: '',
        partsUsed: '',
    });
    const [afterPhoto, setAfterPhoto] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPoints, setShowPoints] = useState(false);
    const [calculatedPoints, setCalculatedPoints] = useState<ReturnType<typeof calculateMaintenancePoints> | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // ✅ Handle image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateImageFile(file);
        if (!validation.valid) {
            setUploadError(validation.error || 'ملف غير صالح');
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            const result = await uploadFileToImgBB(file, (progress) => {
                console.log('Upload progress:', progress);
            });

            if (result.success && result.url) {
                setAfterPhoto(result.url);
                setUploadError(null);
            } else {
                setUploadError(result.error || 'فشل رفع الصورة');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            setUploadError(error.message || 'حدث خطأ أثناء رفع الصورة');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async () => {
        const startTime = request.timeline.startedAt || request.timestamp;
        const endTime = new Date();

        // Calculate points
        const points = calculateMaintenancePoints(maintenanceType, new Date(startTime), endTime);
        setCalculatedPoints(points);
        setShowPoints(true);

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 2000));

        setIsSubmitting(true);
        try {
            const report: MaintenanceReport = {
                description: formData.description,
                beforePhoto: request.beforePhoto || undefined,
                afterPhoto: afterPhoto || undefined, // ✅ Use real uploaded photo
                partsUsed: formData.partsUsed || undefined,
                maintenanceType,
                pointsEarned: points.total,
                duration: points.duration,
            };

            await onSubmit(report);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90" onClick={onClose} style={{ backdropFilter: 'none' }} />

            <div className="relative w-full max-w-lg max-h-[90vh] rounded-3xl overflow-hidden animate-slide-up" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                {/* Points Animation Overlay */}
                {showPoints && calculatedPoints && (
                    <div className="absolute inset-0 z-10 bg-black/90 flex items-center justify-center">
                        <div className="text-center animate-bounce-in">
                            <div className="text-6xl mb-4">🔧</div>
                            <p className="text-4xl font-bold text-orange-400 mb-2">
                                +{calculatedPoints.total}
                            </p>
                            <p className="text-lg text-white/70">نقطة</p>
                            <p className="text-sm text-white/50 mt-2">
                                {calculatedPoints.duration} دقيقة - {getMaintenanceTypeLabel(maintenanceType)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="sticky top-0 p-4 border-b border-white/10 flex items-center justify-between" style={{ background: 'var(--theme-bg-secondary)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                            <Wrench className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">إتمام الصيانة - غرفة {request.roomNumber}</h2>
                            <p className="text-sm text-white/60 flex items-center gap-2">
                                {CATEGORY_ICONS[maintenanceType]}
                                {getMaintenanceTypeLabel(maintenanceType)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">

                    {/* Description */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2">وصف الإصلاح *</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input min-h-[100px] resize-none"
                            placeholder="ما تم إصلاحه أو تغييره..."
                            required
                        />
                    </div>

                    {/* Parts Used */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            قطع الغيار المستخدمة
                        </label>
                        <input
                            type="text"
                            value={formData.partsUsed}
                            onChange={(e) => setFormData({ ...formData, partsUsed: e.target.value })}
                            className="input"
                            placeholder="مثال: لمبة LED، بطارية..."
                        />
                    </div>

                    {/* Before Photo Status */}
                    {request.beforePhoto && (
                        <div className="p-3 rounded-xl bg-green-500/20 text-green-400 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm">صورة "قبل" تم التقاطها</span>
                        </div>
                    )}

                    {/* After Photo - Real Upload */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2 flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            صورة "بعد" الإصلاح
                        </label>
                        
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                        
                        {/* Upload Area */}
                        {!afterPhoto ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className={`w-full p-6 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 ${
                                    isUploading 
                                        ? 'border-orange-500/50 bg-orange-500/10 cursor-wait' 
                                        : 'border-white/20 hover:border-orange-500/50 hover:bg-orange-500/5 text-white/50 hover:text-white/70'
                                }`}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                                        <span className="text-orange-400 text-sm">جاري رفع الصورة...</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                                                <Camera className="w-6 h-6 text-orange-400" />
                                            </div>
                                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                <Upload className="w-6 h-6 text-blue-400" />
                                            </div>
                                        </div>
                                        <span className="text-sm">التقط صورة أو اختر من المعرض</span>
                                    </>
                                )}
                            </button>
                        ) : (
                            // ✅ Photo Preview
                            <div className="relative">
                                <img 
                                    src={afterPhoto} 
                                    alt="صورة بعد الإصلاح"
                                    className="w-full h-48 object-cover rounded-xl border border-green-500/50"
                                />
                                <div className="absolute top-2 right-2 flex gap-2">
                                    <span className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        تم الرفع
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAfterPhoto(null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="px-3 py-1 rounded-full bg-red-500/80 text-white text-xs font-bold hover:bg-red-500 transition-colors"
                                    >
                                        حذف
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {/* Upload Error */}
                        {uploadError && (
                            <p className="mt-2 text-sm text-red-400 flex items-center gap-2">
                                <X className="w-4 h-4" />
                                {uploadError}
                            </p>
                        )}
                    </div>

                    {/* Points Preview */}
                    <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                        <div className="flex items-center gap-2 text-orange-400 mb-2">
                            <Star className="w-5 h-5" />
                            <span className="font-medium">النقاط المتوقعة</span>
                        </div>
                        <p className="text-sm text-white/60">
                            {getMaintenanceTypeLabel(maintenanceType)}: +{calculateMaintenancePoints(maintenanceType, new Date(), new Date()).typeBonus} نقطة أساسية
                            <br />
                            + مكافأة السرعة حسب الوقت المستغرق
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="sticky bottom-0 p-4 border-t border-white/10" style={{ background: 'var(--theme-bg-secondary)' }}>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.description}
                        className="btn-success w-full py-4"
                    >
                        {isSubmitting ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                إتمام الصيانة وحساب النقاط
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Animation Styles */}
            <style>{`
                @keyframes bounce-in {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.5s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default MaintenanceCompleteModal;
