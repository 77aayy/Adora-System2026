/**
 * Biometric Setup Modal
 * Guides user through biometric registration (4 attempts)
 * Shows only 5 times max if user keeps skipping
 */

import React, { useState, useEffect } from 'react';
import { Fingerprint, CheckCircle, X, AlertCircle, RefreshCw } from 'lucide-react';
import {
    registerBiometric,
    isBiometricSupported,
    hasBiometricRegistered,
    recordBiometricSkip,
    getBiometricSkipCount
} from '../../services/biometricService';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { useUX } from '../../context/UXContext';

interface BiometricSetupModalProps {
    onComplete: () => void;
    onSkip: () => void;
}

export const BiometricSetupModal: React.FC<BiometricSetupModalProps> = ({
    onComplete,
    onSkip
}) => {
    const { user } = useAuth();
    const { success, error, warning } = useUX();
    const [attempt, setAttempt] = useState(1);
    const [isRegistering, setIsRegistering] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [supported, setSupported] = useState(false);
    const [currentSkipCount, setCurrentSkipCount] = useState(0);

    const totalAttempts = 4; // 4 attempts for better accuracy
    const maxSkips = 5; // After 5 skips, don't show again

    useEffect(() => {
        setSupported(isBiometricSupported());
        
        // Get current skip count
        if (user) {
            const skipCount = getBiometricSkipCount(user.id, user.tenantId);
            setCurrentSkipCount(skipCount);
        }
    }, [user]);

    const handleRegister = async () => {
        if (!user) return;

        setIsRegistering(true);
        try {
            await registerBiometric(
                user.id,
                user.tenantId,
                user.branchId,
                attempt
            );

            if (attempt >= totalAttempts) {
                setCompleted(true);
                success('تم تسجيل البصمة بنجاح! يمكنك الآن الدخول بالبصمة');
                setTimeout(() => {
                    onComplete();
                }, 2000);
            } else {
                setAttempt(attempt + 1);
                success(`تم تسجيل المحاولة ${attempt}/${totalAttempts}. يرجى المحاولة مرة أخرى`);
            }
        } catch (err: any) {
            error(err.message || 'فشل تسجيل البصمة');
        } finally {
            setIsRegistering(false);
        }
    };

    const handleSkip = () => {
        if (!user) {
            onSkip();
            return;
        }

        const { skipCount, isPermanent } = recordBiometricSkip(user.id, user.tenantId);
        
        if (isPermanent) {
            warning('لن تظهر هذه النافذة مرة أخرى. يمكنك تفعيل البصمة من الإعدادات لاحقاً');
        } else {
            const remaining = maxSkips - skipCount;
            if (remaining <= 2) {
                warning(`ستظهر هذه النافذة ${remaining} مرة/مرات فقط`);
            }
        }
        
        onSkip();
    };

    if (!supported) {
        return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="solid-modal rounded-2xl p-6 max-w-md w-full" style={{ background: '#1e293b' }}>
                    <div className="text-center">
                        <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">البصمة غير مدعومة</h3>
                        <p className="text-slate-400 mb-6">
                            متصفحك أو جهازك لا يدعم تسجيل الدخول بالبصمة.
                            يمكنك استخدام كود الدخول بدلاً من ذلك.
                        </p>
                        <button
                            onClick={onSkip}
                            className="px-6 py-3 bg-teal-500 rounded-xl text-white hover:bg-teal-600 transition-colors"
                        >
                            موافق
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                <div className="solid-modal rounded-2xl p-6 max-w-md w-full" style={{ background: '#1e293b' }}>
                    <div className="text-center">
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4 animate-pulse" />
                        <h3 className="text-xl font-bold text-white mb-2">تم بنجاح! ✅</h3>
                        <p className="text-slate-400">
                            تم تسجيل البصمة بنجاح. يمكنك الآن الدخول بالبصمة في المرة القادمة.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="solid-modal rounded-2xl p-6 max-w-md w-full" style={{ background: '#1e293b' }}>
                <div className="text-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                        <Fingerprint className="w-10 h-10 text-teal-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">تسجيل البصمة</h3>
                    <p className="text-white/60">
                        للمزيد من الأمان، يرجى تسجيل بصمتك للدخول السريع
                    </p>
                </div>

                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/60">المحاولة {attempt} من {totalAttempts}</span>
                        <span className="text-sm text-white/60">{Math.round((attempt / totalAttempts) * 100)}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                        <div
                            className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(attempt / totalAttempts) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
                    <p className="text-sm text-blue-400 text-center">
                        {attempt === 1 && '🔒 اضغط على البصمة أو Face ID للمرة الأولى'}
                        {attempt === 2 && '🔒 اضغط مرة أخرى للمرة الثانية'}
                        {attempt === 3 && '🔒 اضغط مرة أخرى للمرة الثالثة'}
                        {attempt === 4 && '🔒 المحاولة الأخيرة - اضغط مرة أخرى'}
                    </p>
                </div>

                {/* Skip counter info */}
                {currentSkipCount > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-xs text-yellow-400 text-center">
                            ⚠️ تم تخطي هذه النافذة {currentSkipCount} مرة من أصل {maxSkips}
                            {currentSkipCount >= 3 && ' - لن تظهر مرة أخرى بعد ذلك'}
                        </p>
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleSkip}
                        className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-colors text-sm"
                    >
                        تخطي ({maxSkips - currentSkipCount} متبقية)
                    </button>
                    <button
                        onClick={handleRegister}
                        disabled={isRegistering}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl text-white hover:from-teal-600 hover:to-teal-700 transition-all font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isRegistering ? (
                            <>
                                <AdoraLoaderInline size={16} />
                                جاري التسجيل...
                            </>
                        ) : (
                            <>
                                <Fingerprint className="w-4 h-4" />
                                تسجيل البصمة
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
