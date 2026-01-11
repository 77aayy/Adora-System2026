/**
 * Guest Rating Prompt
 * تقييم النزيل من العامل بعد إنهاء المهمة
 * 
 * ✅ Features:
 * - Simple 👍/👎 rating
 * - Optional reason selection for dislikes
 * - Quick and non-intrusive
 * 
 * Adora Hotel Management System V3
 */

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, X, AlertTriangle, Check } from 'lucide-react';
import { rateGuest } from '../../services/guestLoyaltyService';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// TYPES
// ============================================================

interface GuestRatingPromptProps {
    isOpen: boolean;
    onClose: () => void;
    guestId: string;
    guestPhone: string;
    roomNumber: string;
    requestId: string;
    requestType: string;
    tenantId: string;
    onRated?: (rating: 'like' | 'dislike') => void;
}

// Dislike reasons
const DISLIKE_REASONS = [
    { id: 'dirty', label: 'الغرفة كانت متسخة جداً', icon: '🗑️' },
    { id: 'rude', label: 'تعامل غير لائق', icon: '😤' },
    { id: 'damage', label: 'إتلاف في الممتلكات', icon: '💔' },
    { id: 'noise', label: 'إزعاج للآخرين', icon: '🔊' },
    { id: 'other', label: 'سبب آخر', icon: '📝' }
];

// ============================================================
// COMPONENT
// ============================================================

export const GuestRatingPrompt: React.FC<GuestRatingPromptProps> = ({
    isOpen,
    onClose,
    guestId,
    guestPhone,
    roomNumber,
    requestId,
    requestType,
    tenantId,
    onRated
}) => {
    const { user } = useAuth();
    const [selectedRating, setSelectedRating] = useState<'like' | 'dislike' | null>(null);
    const [selectedReason, setSelectedReason] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!selectedRating || !user) return;
        
        // For dislike, require a reason
        if (selectedRating === 'dislike' && !selectedReason) return;

        setLoading(true);

        try {
            await rateGuest(tenantId, {
                guestId,
                guestPhone,
                roomNumber,
                requestId,
                requestType,
                workerId: user.id,
                workerName: user.name,
                workerDepartment: user.department || 'unknown',
                rating: selectedRating,
                reason: selectedReason || undefined
            });

            setSubmitted(true);
            onRated?.(selectedRating);

            // Auto close after success
            setTimeout(() => {
                onClose();
            }, 1500);

        } catch (error) {
            console.error('Error submitting rating:', error);
        } finally {
            setLoading(false);
        }
    };

    // Success state
    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                <div className="bg-slate-900 rounded-2xl p-8 text-center animate-in zoom-in duration-200">
                    <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-teal-400" />
                    </div>
                    <p className="text-white text-lg font-bold">شكراً على تقييمك! ✨</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
            <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md overflow-hidden animate-in slide-in-from-bottom duration-300">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">تقييم سريع</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    
                    {/* Question */}
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                            <span className="text-2xl">🏠</span>
                        </div>
                        <p className="text-white font-medium mb-1">
                            غرفة {roomNumber}
                        </p>
                        <p className="text-white/60 text-sm">
                            كيف كانت حالة الغرفة وتعامل النزيل؟
                        </p>
                    </div>

                    {/* Rating Buttons */}
                    {!selectedRating && (
                        <div className="flex gap-4 justify-center mb-6">
                            <button
                                onClick={() => setSelectedRating('like')}
                                className="flex-1 max-w-[140px] py-6 rounded-2xl bg-teal-500/20 border-2 border-teal-500/30
                                           hover:bg-teal-500/30 hover:border-teal-500/50 transition-all
                                           flex flex-col items-center gap-2 group"
                            >
                                <ThumbsUp className="w-10 h-10 text-teal-400 group-hover:scale-110 transition-transform" />
                                <span className="text-teal-400 font-bold">ممتاز 👍</span>
                            </button>
                            
                            <button
                                onClick={() => setSelectedRating('dislike')}
                                className="flex-1 max-w-[140px] py-6 rounded-2xl bg-red-500/20 border-2 border-red-500/30
                                           hover:bg-red-500/30 hover:border-red-500/50 transition-all
                                           flex flex-col items-center gap-2 group"
                            >
                                <ThumbsDown className="w-10 h-10 text-red-400 group-hover:scale-110 transition-transform" />
                                <span className="text-red-400 font-bold">سيء 👎</span>
                            </button>
                        </div>
                    )}

                    {/* Like Selected - Quick Submit */}
                    {selectedRating === 'like' && (
                        <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4 animate-bounce">
                                <ThumbsUp className="w-10 h-10 text-teal-400" />
                            </div>
                            <p className="text-teal-400 font-bold text-lg mb-6">تقييم إيجابي ✨</p>
                            
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedRating(null)}
                                    className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 font-medium
                                               hover:bg-white/20 transition-colors"
                                >
                                    تغيير
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="flex-1 py-3 rounded-xl bg-teal-600 text-white font-bold
                                               hover:bg-teal-700 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'جاري الإرسال...' : 'تأكيد ✓'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Dislike Selected - Need Reason */}
                    {selectedRating === 'dislike' && (
                        <div>
                            <div className="flex items-center gap-2 mb-4 text-red-400">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="font-medium">اختر سبب التقييم السلبي:</span>
                            </div>

                            <div className="space-y-2 mb-6">
                                {DISLIKE_REASONS.map(reason => (
                                    <button
                                        key={reason.id}
                                        onClick={() => setSelectedReason(reason.id)}
                                        className={`w-full p-3 rounded-xl border-2 text-right flex items-center gap-3 transition-all ${
                                            selectedReason === reason.id
                                                ? 'bg-red-500/20 border-red-500/50 text-white'
                                                : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                                        }`}
                                    >
                                        <span className="text-xl">{reason.icon}</span>
                                        <span>{reason.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setSelectedRating(null);
                                        setSelectedReason(null);
                                    }}
                                    className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 font-medium
                                               hover:bg-white/20 transition-colors"
                                >
                                    تغيير
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !selectedReason}
                                    className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold
                                               hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'جاري الإرسال...' : 'تأكيد التقييم'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Privacy Note */}
                    <p className="text-center text-white/40 text-xs mt-4">
                        🔒 تقييمك سري ولا يظهر للنزيل
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GuestRatingPrompt;
