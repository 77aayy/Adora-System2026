/**
 * Guest Layout
 * Clean mobile-first layout for guest interface
 * Adora Hotel Management System V2
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QrCode, AlertTriangle } from 'lucide-react';
import { logger } from '../services/loggerService';

// ============================================================
// ROOM CONTEXT
// ============================================================

interface RoomContextType {
    roomNumber: string | null;
    guestName: string;
    setGuestName: (name: string) => void;
}

const RoomContext = createContext<RoomContextType>({
    roomNumber: null,
    guestName: 'ضيف',
    setGuestName: () => { },
});

export const useRoom = () => useContext(RoomContext);

// ============================================================
// GUEST LAYOUT COMPONENT
// ============================================================

interface GuestLayoutProps {
    children: React.ReactNode;
}

export const GuestLayout: React.FC<GuestLayoutProps> = ({ children }) => {
    const [searchParams] = useSearchParams();
    const [guestName, setGuestName] = useState('ضيف');

    // 🛡️ SECURITY: Ignore room from URL - it can be manipulated!
    // Only check for token - token is the ONLY source of truth
    const token = searchParams.get('t') || searchParams.get('token');
    
    // ✅ SECURITY: No sensitive data in logs
    logger.debug('Token-only validation - ignoring room param', { hasToken: !!token }, 'GuestLayout');

    // 🛡️ SECURITY: Only show QR scan prompt if NO token
    // If token exists, GuestDashboard will validate it and extract room data from token
    if (!token) {
        console.log('⚠️ [GuestLayout] No token - showing QR scan prompt');
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50">
                {/* Background decorations */}
                <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-gradient-to-br from-teal-400/20 to-cyan-400/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-32 -right-32 w-[350px] h-[350px] bg-gradient-to-br from-cyan-400/20 to-emerald-400/10 rounded-full blur-3xl" />
                
                <div className="relative z-10 bg-white/90 backdrop-blur-sm max-w-md w-full text-center p-8 rounded-3xl shadow-xl shadow-teal-100 border border-teal-100">
                    {/* Logo */}
                    <img
                        src="/adora-logo.png"
                        alt="Adora"
                        className="w-24 h-24 object-contain mx-auto mb-4"
                        style={{ filter: 'drop-shadow(0 10px 30px rgba(20, 184, 166, 0.3))' }}
                    />
                    
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/30">
                        <QrCode className="w-10 h-10 text-white" />
                    </div>

                    <h1 className="text-2xl font-bold mb-3 text-teal-800">
                        مرحباً بك في فندق أدورا
                    </h1>

                    <p className="mb-6 text-slate-600">
                        يرجى مسح رمز QR الموجود في غرفتك للوصول إلى خدمات الفندق
                    </p>

                    <div className="rounded-xl p-4 flex items-center gap-3 bg-amber-50 border border-amber-200">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                        <p className="text-sm text-right text-amber-700">
                            إذا كنت ترى هذه الرسالة بعد المسح، يرجى التواصل مع الاستقبال
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // 🛡️ SECURITY: GuestDashboard will extract roomNumber from token validation
    // Pass null for roomNumber - it will be set after token validation
    console.log('✅ [GuestLayout] SECURITY: Rendering GuestDashboard - roomNumber will be extracted from token validation');
    return (
        <RoomContext.Provider value={{ roomNumber: null, guestName, setGuestName }}>
            {children}
        </RoomContext.Provider>
    );
};

export default GuestLayout;
