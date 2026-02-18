/**
 * Guest Portal Gate
 * يتحقق من تفعيل ميزة بوابة النزيل (qrCodeGuestPortal) عالمياً قبل عرض لوحة الضيف.
 * مصدر الحقيقة: system/settings في Firestore (من إعدادات المالك).
 */

import React, { useEffect, useState } from 'react';
import { getSystemSettings } from '../../services/systemSettingsService';
import { QrCode } from 'lucide-react';

interface GuestPortalGateProps {
    children: React.ReactNode;
}

export const GuestPortalGate: React.FC<GuestPortalGateProps> = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getSystemSettings(false)
            .then((settings) => {
                if (cancelled) return;
                const value = settings?.features?.qrCodeGuestPortal;
                setEnabled(value === true);
            })
            .catch(() => {
                if (!cancelled) setEnabled(true);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '120ms' }} />
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '240ms' }} />
                    </div>
                    <p className="text-sm text-slate-400">جاري التحقق...</p>
                </div>
            </div>
        );
    }

    if (!enabled) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
                <div className="max-w-md w-full text-center rounded-2xl p-8 border border-white/10 bg-slate-800/60 backdrop-blur">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
                        <QrCode className="w-8 h-8 text-amber-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">البوابة غير متاحة حالياً</h1>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        تم تعطيل بوابة النزيل من إعدادات المنصة. يرجى التواصل مع الإدارة لتفعيلها.
                    </p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
