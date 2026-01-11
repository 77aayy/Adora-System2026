/**
 * Micro Feedback Component (تقييم لحظي بالإيموجي)
 * تقييم سريع بعد إغلاق أي طلب
 * 
 * ✅ Features:
 * - 3 emoji options (😄 😐 ☹️)
 * - Instant submission
 * - Negative feedback alerts manager
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { db } from '../../services/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface MicroFeedbackProps {
    isOpen: boolean;
    onClose: () => void;
    requestId: string;
    requestType: string;
    roomNumber: string;
    tenantId: string;
    branchId: string;
    employeeId?: string;
    employeeName?: string;
}

interface FeedbackOption {
    id: 'happy' | 'neutral' | 'sad';
    emoji: string;
    label: string;
    labelEn: string;
    color: string;
    bgColor: string;
    value: number; // 5, 3, 1
}

// ============================================================
// FEEDBACK OPTIONS
// ============================================================

const FEEDBACK_OPTIONS: FeedbackOption[] = [
    {
        id: 'happy',
        emoji: '😄',
        label: 'ممتاز',
        labelEn: 'Excellent',
        color: 'text-green-400',
        bgColor: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30',
        value: 5
    },
    {
        id: 'neutral',
        emoji: '😐',
        label: 'مقبول',
        labelEn: 'OK',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30',
        value: 3
    },
    {
        id: 'sad',
        emoji: '☹️',
        label: 'غير راضي',
        labelEn: 'Unsatisfied',
        color: 'text-red-400',
        bgColor: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30',
        value: 1
    }
];

// ============================================================
// COMPONENT
// ============================================================

export const MicroFeedback: React.FC<MicroFeedbackProps> = ({
    isOpen,
    onClose,
    requestId,
    requestType,
    roomNumber,
    tenantId,
    branchId,
    employeeId,
    employeeName
}) => {
    const [selected, setSelected] = useState<FeedbackOption | null>(null);
    const [comment, setComment] = useState('');
    const [showComment, setShowComment] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setSelected(null);
            setComment('');
            setShowComment(false);
            setSubmitted(false);
        }
    }, [isOpen]);

    const handleSelect = (option: FeedbackOption) => {
        setSelected(option);
        haptic('light');

        // Show comment field for negative feedback
        if (option.id === 'sad') {
            setShowComment(true);
        } else {
            setShowComment(false);
            // Auto-submit for positive/neutral
            setTimeout(() => handleSubmit(option), 500);
        }
    };

    const handleSubmit = async (feedbackOption?: FeedbackOption) => {
        const feedback = feedbackOption || selected;
        if (!feedback || submitting) return;

        setSubmitting(true);
        haptic('medium');

        try {
            // Save feedback
            const feedbackData = {
                requestId,
                requestType,
                roomNumber,
                feedbackType: feedback.id,
                rating: feedback.value,
                comment: comment || null,
                employeeId: employeeId || null,
                employeeName: employeeName || null,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, `tenants/${tenantId}/branches/${branchId}/feedback`), feedbackData);

            // Update request with rating
            if (requestId) {
                const requestRef = doc(db, `tenants/${tenantId}/branches/${branchId}/requests/${requestId}`);
                await updateDoc(requestRef, {
                    guestRating: feedback.value,
                    guestFeedback: feedback.id,
                    ratedAt: serverTimestamp()
                });
            }

            // 🚨 ALERT MANAGER for negative feedback
            if (feedback.id === 'sad') {
                await addDoc(collection(db, `tenants/${tenantId}/manager_alerts`), {
                    type: 'negative_feedback',
                    severity: 'high',
                    roomNumber,
                    requestId,
                    requestType,
                    employeeId,
                    employeeName,
                    comment: comment || 'لم يحدد',
                    message: `⚠️ تقييم سلبي من غرفة ${roomNumber} على خدمة ${requestType}`,
                    status: 'unread',
                    createdAt: serverTimestamp()
                });
            }

            // Update employee rating if applicable
            if (employeeId) {
                await addDoc(collection(db, `tenants/${tenantId}/employee_ratings`), {
                    employeeId,
                    employeeName,
                    rating: feedback.id === 'happy' ? 'positive' : feedback.id === 'sad' ? 'negative' : 'neutral',
                    ratingValue: feedback.value,
                    requestId,
                    requestType,
                    roomNumber,
                    comment: comment || null,
                    createdAt: serverTimestamp()
                });
            }

            setSubmitted(true);
            playSound('success');
            haptic('success');

            // Auto close after showing thank you
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (error) {
            console.error('Error submitting feedback:', error);
            haptic('error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Thank you screen
    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                <div className="bg-slate-900 rounded-3xl p-8 text-center animate-in zoom-in duration-300 max-w-sm w-full">
                    <div className="text-6xl mb-4 animate-bounce">🙏</div>
                    <h3 className="text-xl font-bold text-white mb-2">شكراً لتقييمك!</h3>
                    <p className="text-white/60 text-sm">رأيك يساعدنا على تحسين خدماتنا</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
            <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md 
                           overflow-hidden animate-in slide-in-from-bottom duration-300 shadow-2xl">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h3 className="text-lg font-bold text-white">كيف كانت الخدمة؟</h3>
                        <p className="text-white/60 text-sm">غرفة {roomNumber}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Feedback Options */}
                <div className="p-6">
                    <div className="flex justify-center gap-4 mb-6">
                        {FEEDBACK_OPTIONS.map(option => (
                            <button
                                key={option.id}
                                onClick={() => handleSelect(option)}
                                disabled={submitting}
                                className={`
                                    flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300
                                    ${selected?.id === option.id 
                                        ? `${option.bgColor} scale-110 shadow-lg` 
                                        : 'bg-white/5 border-white/10 hover:border-white/30'
                                    }
                                    disabled:opacity-50
                                `}
                            >
                                <span className={`text-4xl transition-transform ${selected?.id === option.id ? 'scale-125' : ''}`}>
                                    {option.emoji}
                                </span>
                                <span className={`text-sm font-medium ${selected?.id === option.id ? option.color : 'text-white/70'}`}>
                                    {option.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Comment for negative feedback */}
                    {showComment && (
                        <div className="animate-in slide-in-from-top duration-300">
                            <label className="block text-white/60 text-sm mb-2">
                                ما الذي يمكننا تحسينه؟ <span className="text-white/40">(اختياري)</span>
                            </label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                placeholder="أخبرنا المزيد..."
                                className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm
                                           placeholder:text-white/30 focus:outline-none focus:border-red-500/50
                                           resize-none h-20"
                                dir="rtl"
                            />
                            <button
                                onClick={() => handleSubmit()}
                                disabled={submitting}
                                className="w-full mt-4 py-3 rounded-xl bg-red-600 text-white font-bold
                                           hover:bg-red-700 transition-colors disabled:opacity-50
                                           flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <span>جاري الإرسال...</span>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>إرسال التقييم</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Skip option */}
                {!showComment && !selected && (
                    <div className="px-6 pb-6">
                        <button
                            onClick={onClose}
                            className="w-full py-2 text-white/40 text-sm hover:text-white/60 transition-colors"
                        >
                            تخطي
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MicroFeedback;
