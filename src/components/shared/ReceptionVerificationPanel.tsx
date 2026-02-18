/**
 * Reception Verification Panel
 * Displays pending guest verification requests
 * Supports auto-approval timeout and points system
 * Adora Hotel Management System V2 - SaaS
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, User } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, Timestamp, getDoc } from 'firebase/firestore';
import { calculateVerificationPoints, getVerificationPointsMessage } from '../../utils/pointsCalculator';
import { awardPoints } from '../../services/pointsService';
import { logger } from '../../services/loggerService';

// ============================================================
// TYPES
// ============================================================

interface GuestVerification {
    id: string;
    roomNumber: string;
    branchId: string;
    tenantId: string;
    firstName: string | null;
    identityOrPhone: string;
    verificationType: 'identity' | 'phone';
    status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
    createdAt: any;
    expiresAt: any;
    approvedBy?: string;
    approvedAt?: any;
}

interface ReceptionVerificationPanelProps {
    branchId: string;
    tenantId: string;
    userId: string;
    userName: string;
}

// ============================================================
// COMPONENT
// ============================================================

export const ReceptionVerificationPanel: React.FC<ReceptionVerificationPanelProps> = ({
    branchId,
    tenantId,
    userId,
    userName
}) => {
    const [verifications, setVerifications] = useState<GuestVerification[]>([]);
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);

    // ============================================================
    // LOAD SETTINGS
    // ============================================================

    useEffect(() => {
        const loadSettings = async () => {
            try {
                // Load reception settings for timeout and points
                const settingsRef = doc(db, `tenants/${tenantId}/branches/${branchId}/settings`, 'reception');
                const settingsSnap = await getDoc(settingsRef);
                if (settingsSnap.exists()) {
                    setSettings(settingsSnap.data());
                }
            } catch (error) {
                logger.error('Error loading settings:', error, 'ReceptionVerificationPanel');
            }
        };
        loadSettings();
    }, [tenantId, branchId]);

    // ============================================================
    // LISTEN FOR PENDING VERIFICATIONS
    // ============================================================

    useEffect(() => {
        const verificationsRef = collection(db, 'guestVerifications');
        const q = query(
            verificationsRef,
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as GuestVerification));
            setVerifications(data);
            setLoading(false); // ✅ Always set loading to false
        }, (error) => {
            logger.error('Error loading verifications:', error, 'ReceptionVerificationPanel');
            setLoading(false); // ✅ Set loading false on error too
        });

        return () => unsubscribe();
    }, [branchId, tenantId]);

    // ============================================================
    // AUTO-APPROVAL TIMER
    // ============================================================

    useEffect(() => {
        const interval = setInterval(() => {
            verifications.forEach(async (verification) => {
                const now = Date.now();
                const expiresAt = verification.expiresAt?.toMillis();

                if (expiresAt && now >= expiresAt) {
                    // Auto-approve
                    await handleAutoApprove(verification);
                }
            });
        }, 1000); // Check every second

        return () => clearInterval(interval);
    }, [verifications]);

    // ============================================================
    // APPROVE/REJECT HANDLERS
    // ============================================================

    const handleApprove = async (verification: GuestVerification) => {
        try {
            const verificationRef = doc(db, 'guestVerifications', verification.id);
            const approvedAt = Timestamp.now();

            await updateDoc(verificationRef, {
                status: 'approved',
                approvedBy: userName,
                approvedAt
            });

            // Calculate and award points
            const points = calculateVerificationPoints(
                verification.createdAt.toDate(),
                approvedAt.toDate(),
                false, // Manual approval
                settings
            );

            await awardPoints(
                tenantId,
                userId,
                points.total,
                `تحقق من النزيل - غرفة ${verification.roomNumber}`
            );

            logger.info('✅ Verification approved:', getVerificationPointsMessage(points), 'ReceptionVerificationPanel');
        } catch (error) {
            logger.error('Error approving verification:', error, 'ReceptionVerificationPanel');
        }
    };

    const handleReject = async (verification: GuestVerification) => {
        try {
            const verificationRef = doc(db, 'guestVerifications', verification.id);

            await updateDoc(verificationRef, {
                status: 'rejected',
                rejectedBy: userName,
                rejectedAt: Timestamp.now()
            });

            logger.info('❌ Verification rejected', undefined, 'ReceptionVerificationPanel');
        } catch (error) {
            logger.error('Error rejecting verification:', error, 'ReceptionVerificationPanel');
        }
    };

    const handleAutoApprove = async (verification: GuestVerification) => {
        try {
            const verificationRef = doc(db, 'guestVerifications', verification.id);
            const autoApprovedAt = Timestamp.now();

            await updateDoc(verificationRef, {
                status: 'auto_approved',
                autoApprovedAt
            });

            // Calculate and award points (with penalty for timeout)
            const points = calculateVerificationPoints(
                verification.createdAt.toDate(),
                autoApprovedAt.toDate(),
                true, // Auto-approved = penalty
                settings
            );

            // Still award points (even if negative/zero)
            if (points.total > 0) {
                await awardPoints(
                    tenantId,
                    userId,
                    points.total,
                    `تحقق تلقائي - غرفة ${verification.roomNumber}`
                );
            }

            logger.info('⏱️ Auto-approved:', getVerificationPointsMessage(points), 'ReceptionVerificationPanel');
        } catch (error) {
            logger.error('Error auto-approving verification:', error, 'ReceptionVerificationPanel');
        }
    };

    // ============================================================
    // TIMER CALCULATION
    // ============================================================

    const getRemainingTime = (expiresAt: any): string => {
        if (!expiresAt) return '00:00';
        const now = Date.now();
        const expires = expiresAt.toMillis();
        const remaining = Math.max(0, expires - now);

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // ============================================================
    // RENDER
    // ============================================================

    // ✅ REMOVED: Loading state causes issues with Firestore connection
    // Panel now shows immediately, empty state handled below

    if (verifications.length === 0) {
        return null; // Don't show anything if no pending verifications
    }

    return (
        <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    طلبات التحقق من النزلاء
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                        {verifications.length}
                    </span>
                </h3>
            </div>

            {verifications.map((verification) => (
                <div
                    key={verification.id}
                    className="glass-card p-4 border-l-4 border-amber-500/50 hover:border-amber-500 transition-all"
                >
                    {/* Header with Timer */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                                <span className="text-xl">🏨</span>
                            </div>
                            <div>
                                <p className="text-white font-bold">غرفة {verification.roomNumber}</p>
                                <p className="text-white/50 text-xs">
                                    {verification.verificationType === 'phone' ? 'تحقق بالجوال' : 'تحقق بالهوية'}
                                </p>
                            </div>
                        </div>

                        {/* Countdown Timer */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30">
                            <Clock className="w-4 h-4 text-red-400 animate-pulse" />
                            <span className="text-red-400 font-mono font-bold text-sm">
                                {getRemainingTime(verification.expiresAt)}
                            </span>
                        </div>
                    </div>

                    {/* Guest Data */}
                    <div className="space-y-2 mb-4">
                        {verification.firstName && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <User className="w-4 h-4 text-blue-400" />
                                <div>
                                    <p className="text-blue-300 text-xs">الاسم الأول</p>
                                    <p className="text-white font-bold">{verification.firstName}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
                            <span className="text-2xl">{verification.verificationType === 'phone' ? '📱' : '🪪'}</span>
                            <div>
                                <p className="text-white/50 text-xs">
                                    {verification.verificationType === 'phone' ? 'رقم الجوال' : 'رقم الهوية'}
                                </p>
                                <p className="text-white font-mono">{verification.identityOrPhone}</p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleApprove(verification)}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-500/25 active:scale-95 transition-all"
                        >
                            <CheckCircle className="w-4 h-4" />
                            موافقة
                        </button>
                        <button
                            onClick={() => handleReject(verification)}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 font-medium flex items-center justify-center gap-2 hover:bg-red-500/30 active:scale-95 transition-all"
                        >
                            <XCircle className="w-4 h-4" />
                            رفض
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
