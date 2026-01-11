/**
 * Inspection Modal
 * Advanced housekeeping completion with minibar, damage report, and points
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    X,
    CheckCircle,
    AlertTriangle,
    Camera,
    DoorOpen,
    UserCheck,
    Minus,
    Plus,
    RefreshCw,
    Star,
    Clock,
    Package,
} from 'lucide-react';
import { Request, ConsumedItem, InspectionReport } from '../../types';
import { Product, subscribeToProducts } from '../../services/productService';
import { calculateCleaningPoints, getPointsMessage, getPerformanceEmoji, CleaningType } from '../../utils/pointsCalculator';
import { ImageUpload } from '../../components/common/ImageUpload';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';

// ============================================================
// TYPES
// ============================================================

interface InspectionModalProps {
    isOpen: boolean;
    request: Request;
    onClose: () => void;
    onSubmit: (report: InspectionReport) => Promise<void>;
    isSubmitting?: boolean; // ✅ UX: Loading state from parent
}

// ============================================================
// COMPONENT
// ============================================================

export const InspectionModal: React.FC<InspectionModalProps> = ({
    isOpen,
    request,
    onClose,
    onSubmit,
    isSubmitting: externalIsSubmitting = false,
}) => {
    const [cleaningType, setCleaningType] = useState<CleaningType>('checkout');
    const [hasIssues, setHasIssues] = useState(false);
    const [issueDescription, setIssueDescription] = useState('');
    const [issuePhoto, setIssuePhoto] = useState<string | undefined>(undefined);
    const [products, setProducts] = useState<Product[]>([]);
    const [consumption, setConsumption] = useState<Record<string, number>>({});
    // ✅ UX: Use external loading state if provided, otherwise use internal
    const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
    const isSubmitting = externalIsSubmitting || internalIsSubmitting;
    const [showPoints, setShowPoints] = useState(false);
    const [calculatedPoints, setCalculatedPoints] = useState<ReturnType<typeof calculateCleaningPoints> | null>(null);

    // Load products
    useEffect(() => {
        if (!isOpen) return;
        const unsub = subscribeToProducts((data) => {
            setProducts(data.filter(p => p.category === 'minibar'));
        });
        return () => unsub();
    }, [isOpen]);

    if (!isOpen) return null;

    // Update consumption
    const updateConsumption = (productId: string, delta: number) => {
        setConsumption((prev) => {
            const current = prev[productId] || 0;
            const newValue = Math.max(0, current + delta);
            if (newValue === 0) {
                const { [productId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [productId]: newValue };
        });
    };

    // Calculate consumption total
    const getConsumptionTotal = (): number => {
        return Object.entries(consumption).reduce((total, [productId, qty]) => {
            const product = products.find(p => p.id === productId);
            return total + (product?.price || 0) * qty;
        }, 0);
    };

    // Get consumed items array
    const getConsumedItems = (): ConsumedItem[] => {
        return Object.entries(consumption).map(([productId, qty]) => {
            const product = products.find(p => p.id === productId)!;
            return {
                productId,
                productName: product.name,
                quantity: qty,
                price: product.price,
                total: product.price * qty,
            };
        });
    };

    // Handle submit
    const handleSubmit = async () => {
        const startTime = request.timeline.startedAt || request.timestamp;
        const endTime = new Date();

        // Calculate points
        const points = calculateCleaningPoints(cleaningType, new Date(startTime), endTime, hasIssues);
        setCalculatedPoints(points);
        setShowPoints(true);

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (!externalIsSubmitting) setInternalIsSubmitting(true);
        try {
            const report: InspectionReport = {
                cleaningType,
                hasIssues,
                issueDescription: hasIssues ? issueDescription : undefined,
                issuePhoto: hasIssues ? issuePhoto : undefined,
                consumedItems: getConsumedItems(),
                consumptionTotal: getConsumptionTotal(),
                pointsEarned: points.total,
                duration: points.duration,
            };

            await onSubmit(report);
            onClose();
        } finally {
            if (!externalIsSubmitting) setInternalIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} style={{ backdropFilter: 'none' }} />

            <div className="relative w-full max-w-lg max-h-[90vh] glass rounded-3xl overflow-hidden animate-slide-up">
                {/* Points Animation Overlay */}
                {showPoints && calculatedPoints && (
                    <div className="absolute inset-0 z-10 bg-black/90 flex items-center justify-center">
                        <div className="text-center animate-bounce-in">
                            <div className="text-6xl mb-4">{getPerformanceEmoji(calculatedPoints)}</div>
                            <p className="text-4xl font-bold text-primary-400 mb-2">
                                +{calculatedPoints.total}
                            </p>
                            <p className="text-lg text-white/70">نقطة</p>
                            <p className="text-sm text-white/50 mt-2">
                                {calculatedPoints.duration} دقيقة
                            </p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="sticky top-0 glass p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">فحص الغرفة {request.roomNumber}</h2>
                            <p className="text-sm text-white/60">إتمام التنظيف</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full glass flex items-center justify-center text-white/70 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">

                    {/* Cleaning Type */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2">نوع التنظيف</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setCleaningType('occupied')}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${cleaningType === 'occupied'
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                                    : 'border-white/20 text-white/60 hover:border-white/40'
                                    }`}
                            >
                                <UserCheck className="w-6 h-6" />
                                <span className="font-medium">غرفة مشغولة</span>
                                <span className="text-xs opacity-60">+3 نقاط</span>
                            </button>
                            <button
                                onClick={() => setCleaningType('checkout')}
                                className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-2 ${cleaningType === 'checkout'
                                    ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                                    : 'border-white/20 text-white/60 hover:border-white/40'
                                    }`}
                            >
                                <DoorOpen className="w-6 h-6" />
                                <span className="font-medium">غرفة مغادرة</span>
                                <span className="text-xs opacity-60">+5 نقاط</span>
                            </button>
                        </div>
                    </div>

                    {/* Minibar Check */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            فحص الميني بار
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {products.length === 0 ? (
                                <p className="text-sm text-white/40 text-center py-4">لا توجد منتجات</p>
                            ) : (
                                products.map((product) => (
                                    <div key={product.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                        <div>
                                            <p className="text-white text-sm">{product.name}</p>
                                            <p className="text-xs text-white/50">{product.price} ريال</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => updateConsumption(product.id, -1)}
                                                className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white"
                                            >
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="w-8 text-center text-white font-medium">
                                                {consumption[product.id] || 0}
                                            </span>
                                            <button
                                                onClick={() => updateConsumption(product.id, 1)}
                                                className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/70 hover:text-white"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {Object.keys(consumption).length > 0 && (
                            <div className="mt-3 p-3 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-between">
                                <span>إجمالي الاستهلاك</span>
                                <span className="font-bold">{getConsumptionTotal()} ريال</span>
                            </div>
                        )}
                    </div>

                    {/* Damage Report */}
                    <div>
                        <label className="block text-sm text-white/70 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            تقرير الأضرار
                        </label>
                        <button
                            onClick={() => setHasIssues(!hasIssues)}
                            className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 ${hasIssues
                                ? 'border-orange-500 bg-orange-500/20 text-orange-400'
                                : 'border-white/20 text-white/60 hover:border-white/40'
                                }`}
                        >
                            <AlertTriangle className="w-5 h-5" />
                            <span>{hasIssues ? 'يوجد ضرر / مشكلة' : 'لا يوجد ضرر'}</span>
                        </button>

                        {hasIssues && (
                            <div className="mt-3 space-y-3 animate-fade-in">
                                <textarea
                                    value={issueDescription}
                                    onChange={(e) => setIssueDescription(e.target.value)}
                                    className="input min-h-[80px] resize-none"
                                    placeholder="وصف المشكلة..."
                                />
                                <ImageUpload
                                    path={`inspections/${request.id}/damage`}
                                    label="صورة الضرر"
                                    placeholder="التقاط صورة للضرر"
                                    onUploadComplete={(url) => setIssuePhoto(url)}
                                    value={issuePhoto}
                                />
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="sticky bottom-0 glass p-4 border-t border-white/10">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="btn-success w-full py-4"
                    >
                        {isSubmitting ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <Star className="w-5 h-5" />
                                إتمام الفحص وحساب النقاط
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

export default InspectionModal;
