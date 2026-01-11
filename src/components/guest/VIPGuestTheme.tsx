/**
 * VIP Guest Theme Provider
 * ثيم ذهبي للنزلاء المميزين
 * 
 * ✅ Features:
 * - Golden theme for high-score guests
 * - Welcome back message
 * - Special badge display
 * - Dynamic background
 * 
 * Adora Hotel Management System V3
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { GuestProfile, getVipBadgeInfo } from '../../services/guestLoyaltyService';

// ============================================================
// TYPES
// ============================================================

interface VIPThemeContextValue {
    isVIP: boolean;
    vipLevel: GuestProfile['vipLevel'];
    respectScore: number;
    guestName?: string;
    totalVisits: number;
    themeClass: string;
    badgeInfo: ReturnType<typeof getVipBadgeInfo>;
}

interface VIPGuestThemeProps {
    children: React.ReactNode;
    guestProfile?: GuestProfile | null;
    isReturningGuest?: boolean;
}

// ============================================================
// CONTEXT
// ============================================================

const VIPThemeContext = createContext<VIPThemeContextValue | null>(null);

export const useVIPTheme = () => useContext(VIPThemeContext);

// ============================================================
// THEME CONFIGURATIONS
// ============================================================

const THEME_CONFIGS: Record<GuestProfile['vipLevel'], {
    gradient: string;
    accent: string;
    glow: string;
    particles: string;
}> = {
    platinum: {
        gradient: 'from-purple-900/30 via-pink-900/20 to-purple-900/30',
        accent: 'text-purple-400',
        glow: 'shadow-purple-500/30',
        particles: 'bg-purple-400'
    },
    gold: {
        gradient: 'from-amber-900/30 via-yellow-900/20 to-amber-900/30',
        accent: 'text-amber-400',
        glow: 'shadow-amber-500/30',
        particles: 'bg-amber-400'
    },
    silver: {
        gradient: 'from-slate-800/50 via-gray-800/30 to-slate-800/50',
        accent: 'text-slate-300',
        glow: 'shadow-slate-400/20',
        particles: 'bg-slate-400'
    },
    regular: {
        gradient: 'from-teal-900/20 via-cyan-900/10 to-teal-900/20',
        accent: 'text-teal-400',
        glow: 'shadow-teal-500/20',
        particles: 'bg-teal-400'
    },
    new: {
        gradient: 'from-slate-900 via-slate-800 to-slate-900',
        accent: 'text-blue-400',
        glow: '',
        particles: ''
    }
};

// ============================================================
// WELCOME BANNER COMPONENT
// ============================================================

interface WelcomeBannerProps {
    guestName?: string;
    vipLevel: GuestProfile['vipLevel'];
    totalVisits: number;
}

export const VIPWelcomeBanner: React.FC<WelcomeBannerProps> = ({
    guestName,
    vipLevel,
    totalVisits
}) => {
    const badge = getVipBadgeInfo(vipLevel, 0);
    const config = THEME_CONFIGS[vipLevel];

    if (vipLevel === 'new') return null;

    const getWelcomeMessage = () => {
        switch (vipLevel) {
            case 'platinum':
                return `أهلاً وسهلاً بضيفنا البلاتيني ${guestName || ''}! 💎`;
            case 'gold':
                return `مرحباً بعودتك يا ضيفنا الذهبي ${guestName || ''}! ⭐`;
            case 'silver':
                return `أهلاً بك مجدداً ${guestName || ''}! 🥈`;
            case 'regular':
                return `سعداء بعودتك ${guestName || ''}! ✅`;
            default:
                return `مرحباً ${guestName || ''}!`;
        }
    };

    return (
        <div className={`
            relative overflow-hidden rounded-2xl p-4 mb-4
            bg-gradient-to-r ${config.gradient}
            border border-white/10 ${config.glow} shadow-lg
            animate-in slide-in-from-top duration-500
        `}>
            {/* Sparkle Effects */}
            {(vipLevel === 'platinum' || vipLevel === 'gold') && (
                <>
                    <div className={`absolute top-2 right-4 w-2 h-2 rounded-full ${config.particles} animate-ping`} />
                    <div className={`absolute top-4 right-8 w-1.5 h-1.5 rounded-full ${config.particles} animate-ping`} style={{ animationDelay: '0.5s' }} />
                    <div className={`absolute bottom-3 left-6 w-2 h-2 rounded-full ${config.particles} animate-ping`} style={{ animationDelay: '1s' }} />
                </>
            )}

            <div className="relative flex items-center gap-4">
                {/* Badge Icon */}
                <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center text-3xl
                    ${badge.bgColor} ${config.glow} shadow-lg
                `}>
                    {badge.icon}
                </div>

                {/* Welcome Text */}
                <div className="flex-1">
                    <p className={`text-lg font-bold ${config.accent}`}>
                        {getWelcomeMessage()}
                    </p>
                    <p className="text-white/60 text-sm">
                        زيارتك رقم {totalVisits} • {badge.labelAr}
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// FLOATING BADGE COMPONENT
// ============================================================

export const VIPFloatingBadge: React.FC<{ vipLevel: GuestProfile['vipLevel'] }> = ({ vipLevel }) => {
    if (vipLevel === 'new' || vipLevel === 'regular') return null;

    const badge = getVipBadgeInfo(vipLevel, 0);

    return (
        <div className={`
            fixed top-4 left-4 z-40
            px-3 py-1.5 rounded-full
            ${badge.bgColor} backdrop-blur-sm
            border border-white/20
            flex items-center gap-2
            animate-in fade-in slide-in-from-left duration-500
        `}>
            <span className="text-lg">{badge.icon}</span>
            <span className={`text-sm font-bold ${badge.color}`}>{badge.labelAr}</span>
        </div>
    );
};

// ============================================================
// MAIN PROVIDER COMPONENT
// ============================================================

export const VIPGuestTheme: React.FC<VIPGuestThemeProps> = ({
    children,
    guestProfile,
    isReturningGuest = false
}) => {
    const [showWelcome, setShowWelcome] = useState(true);

    const vipLevel = guestProfile?.vipLevel || 'new';
    const isVIP = vipLevel === 'platinum' || vipLevel === 'gold';
    const config = THEME_CONFIGS[vipLevel];
    const badgeInfo = getVipBadgeInfo(vipLevel, guestProfile?.respectScore || 0);

    // Auto-hide welcome after 10 seconds
    useEffect(() => {
        if (isReturningGuest && vipLevel !== 'new') {
            const timer = setTimeout(() => setShowWelcome(false), 10000);
            return () => clearTimeout(timer);
        }
    }, [isReturningGuest, vipLevel]);

    const contextValue: VIPThemeContextValue = {
        isVIP,
        vipLevel,
        respectScore: guestProfile?.respectScore || 0,
        guestName: guestProfile?.name || guestProfile?.firstName,
        totalVisits: guestProfile?.totalVisits || 1,
        themeClass: config.gradient,
        badgeInfo
    };

    return (
        <VIPThemeContext.Provider value={contextValue}>
            {/* VIP Background Overlay */}
            {isVIP && (
                <div className={`
                    fixed inset-0 pointer-events-none z-0
                    bg-gradient-to-b ${config.gradient}
                    opacity-50
                `} />
            )}

            {/* Floating Badge */}
            <VIPFloatingBadge vipLevel={vipLevel} />

            {/* Content */}
            <div className="relative z-10">
                {/* Welcome Banner */}
                {isReturningGuest && showWelcome && vipLevel !== 'new' && (
                    <div className="p-4">
                        <VIPWelcomeBanner
                            guestName={guestProfile?.name || guestProfile?.firstName}
                            vipLevel={vipLevel}
                            totalVisits={guestProfile?.totalVisits || 1}
                        />
                    </div>
                )}

                {children}
            </div>

            {/* VIP Glow Effects */}
            {isVIP && (
                <style>{`
                    @keyframes vip-glow {
                        0%, 100% { opacity: 0.3; }
                        50% { opacity: 0.6; }
                    }
                    .vip-card {
                        box-shadow: 0 0 20px ${vipLevel === 'platinum' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(251, 191, 36, 0.3)'};
                    }
                    .vip-button {
                        background: linear-gradient(135deg, 
                            ${vipLevel === 'platinum' ? '#9333ea' : '#f59e0b'}, 
                            ${vipLevel === 'platinum' ? '#ec4899' : '#fbbf24'}
                        );
                    }
                `}</style>
            )}
        </VIPThemeContext.Provider>
    );
};

export default VIPGuestTheme;
