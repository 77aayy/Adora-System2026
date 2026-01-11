/**
 * Quick Issue Reporter (صندوق البلاغات السريعة)
 * بلاغ بدون كتابة - ضغطة واحدة
 * 
 * ✅ Features:
 * - 3 quick issue buttons
 * - No typing required
 * - Instant notification to reception
 * 
 * Adora Hotel Management System V3
 */

import React, { useState } from 'react';
import { Volume2, Wrench, Sparkles, Check, AlertTriangle, X } from 'lucide-react';
import { db } from '../../services/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface QuickIssueReporterProps {
    tenantId: string;
    branchId: string;
    roomNumber: string;
    guestPhone?: string;
    className?: string;
}

interface QuickIssue {
    id: string;
    type: string;
    icon: string;
    label: string;
    labelEn: string;
    color: string;
    bgColor: string;
    priority: 'low' | 'medium' | 'high';
}

// ============================================================
// QUICK ISSUES CONFIG
// ============================================================

const QUICK_ISSUES: QuickIssue[] = [
    {
        id: 'noise',
        type: 'noise_complaint',
        icon: '🤫',
        label: 'إزعاج',
        labelEn: 'Noise',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        priority: 'high'
    },
    {
        id: 'emergency_maintenance',
        type: 'emergency_maintenance',
        icon: '🛠️',
        label: 'صيانة طارئة',
        labelEn: 'Emergency',
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        priority: 'high'
    },
    {
        id: 'hallway_cleaning',
        type: 'hallway_cleaning',
        icon: '🧹',
        label: 'نظافة الممر',
        labelEn: 'Hallway',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        priority: 'medium'
    }
];

// ============================================================
// COMPONENT
// ============================================================

export const QuickIssueReporter: React.FC<QuickIssueReporterProps> = ({
    tenantId,
    branchId,
    roomNumber,
    guestPhone,
    className = ''
}) => {
    const [submitting, setSubmitting] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleReport = async (issue: QuickIssue) => {
        if (submitting || submitted === issue.id) return;

        setSubmitting(issue.id);
        setError(null);
        haptic('medium');

        try {
            // Create quick report
            await addDoc(collection(db, `tenants/${tenantId}/branches/${branchId}/quick_reports`), {
                type: issue.type,
                roomNumber,
                guestPhone: guestPhone || null,
                priority: issue.priority,
                status: 'pending',
                createdAt: serverTimestamp(),
                // For instant notification
                isFlashAlert: true,
                alertMessage: `${issue.icon} ${issue.label} في غرفة ${roomNumber}`
            });

            // Also create as a regular request for tracking
            await addDoc(collection(db, `tenants/${tenantId}/branches/${branchId}/requests`), {
                type: issue.type,
                requestType: issue.type,
                roomNumber,
                room: roomNumber,
                guestPhone: guestPhone || null,
                status: 'PENDING_RECEPTION',
                priority: issue.priority,
                source: 'quick_report',
                notes: `بلاغ سريع: ${issue.label}`,
                createdAt: serverTimestamp()
            });

            setSubmitted(issue.id);
            playSound('success');
            haptic('success');

            // Reset after 3 seconds
            setTimeout(() => {
                setSubmitted(null);
            }, 3000);

        } catch (err) {
            console.error('Error submitting quick report:', err);
            setError('فشل إرسال البلاغ، حاول مرة أخرى');
            haptic('error');
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className={`${className}`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-white/60 text-sm font-medium">بلاغ سريع</span>
            </div>

            {/* Quick Issue Buttons */}
            <div className="flex gap-2">
                {QUICK_ISSUES.map(issue => {
                    const isSubmitting = submitting === issue.id;
                    const isSubmitted = submitted === issue.id;

                    return (
                        <button
                            key={issue.id}
                            onClick={() => handleReport(issue)}
                            disabled={isSubmitting || isSubmitted}
                            className={`
                                flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl
                                border-2 transition-all duration-300
                                ${isSubmitted 
                                    ? 'bg-green-500/20 border-green-500/50' 
                                    : `${issue.bgColor} border-transparent hover:border-white/20`
                                }
                                ${isSubmitting ? 'animate-pulse' : ''}
                                disabled:opacity-50
                            `}
                        >
                            {isSubmitted ? (
                                <>
                                    <Check className="w-6 h-6 text-green-400" />
                                    <span className="text-green-400 text-xs font-medium">تم!</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-2xl">{issue.icon}</span>
                                    <span className={`text-xs font-medium ${issue.color}`}>
                                        {issue.label}
                                    </span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Error Message */}
            {error && (
                <div className="mt-2 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-lg p-2">
                    <X className="w-3 h-3" />
                    <span>{error}</span>
                </div>
            )}

            {/* Help Text */}
            <p className="text-center text-white/40 text-xs mt-2">
                اضغط للإبلاغ الفوري بدون كتابة
            </p>
        </div>
    );
};

export default QuickIssueReporter;
