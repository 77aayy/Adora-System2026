/**
 * About Us Page
 * Professional About page for Adora Hotel Management System
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import {
    Sparkles, Shield, Zap, Database, Brain, Lock, Users, BarChart3, TrendingUp,
    Award, Globe, Heart, ArrowRight, Home, CheckCircle2, Send, Phone, User, Bed,
    Luggage, Wrench, Coffee, ShoppingCart, MessageSquare, Bell, CreditCard,
    Calendar, Clock, Star, Target, PieChart, Languages, ChevronDown, DoorOpen,
    Key, Moon, Sun
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { UnifiedModal, ModalActions } from '../components/common/UnifiedModal';
import { toast } from '../components/common/EnhancedToast';
import { submitTrialRequest } from '../services/trialRequestService';

// -----------------------------------------------------------------------------
// ثوابت الصفحة (لون العلامة التجارية + إعدادات الرادار)
// -----------------------------------------------------------------------------

const THEME = {
    turquoise: '#20B2AA',
    turquoiseLight: 'rgba(32, 178, 170, 0.1)',
    turquoiseDark: 'rgba(32, 178, 170, 0.2)',
} as const;

const RADAR_CONFIG = {
    ROOM_COUNT: 16,
    SCAN_DURATION_SEC: 8,
    RINGS: 4,
    RAYS: 24,
    SWEEP_WEDGE_DEG: 28,
    SIZE_SCALE: 0.7,
    ROOM_RADIUS_MIN: 22,
    ROOM_RADIUS_MAX: 38,
    SEED: 12345,
} as const;

// -----------------------------------------------------------------------------
// مكوّنات التخطيط
// -----------------------------------------------------------------------------

interface SectionProps {
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = '' }) => (
    <section className={`py-4 sm:py-5 md:py-6 lg:py-8 px-4 sm:px-5 lg:px-6 ${className}`}>
        {children}
    </section>
);

const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`max-w-7xl mx-auto w-full ${className}`}>
        {children}
    </div>
);

// -----------------------------------------------------------------------------
// مكوّنات الواجهة (بطاقات المميزات، أقسام متحركة)
// -----------------------------------------------------------------------------

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    delay?: number;
    compact?: boolean;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, delay = 0, compact = false }) => {
    const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay });
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <div
            ref={ref as React.RefObject<HTMLDivElement>}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`${compact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5'} rounded-xl transition-all duration-500 ease-out cursor-pointer ${
                isVisible 
                    ? 'opacity-100 translate-y-0 scale-100' 
                    : 'opacity-0 translate-y-12 scale-95'
            }`}
            style={{
                background: 'var(--theme-bg-tertiary)',
                border: `1px solid ${isHovered ? 'rgba(32, 178, 170, 0.4)' : 'var(--theme-border-primary)'}`,
                boxShadow: isHovered 
                    ? '0 20px 60px rgba(32, 178, 170, 0.3), 0 10px 30px rgba(32, 178, 170, 0.2), 0 0 0 1px rgba(32, 178, 170, 0.1)'
                    : isVisible 
                        ? '0 10px 40px rgba(0, 0, 0, 0.1), 0 4px 20px rgba(32, 178, 170, 0.1)' 
                        : '0 4px 12px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isHovered 
                    ? 'translateY(-8px) scale(1.03) rotate(0deg)' 
                    : isVisible 
                        ? 'translateY(0) scale(1)' 
                        : 'translateY(48px) scale(0.95)',
                position: 'relative',
                overflow: 'hidden',
                willChange: 'transform, box-shadow'
            }}
        >
            {/* Enhanced Shimmer effect overlay - More visible on hover */}
            {isVisible && (
                <div 
                    className="absolute inset-0 shimmer-effect pointer-events-none"
                    style={{
                        opacity: isHovered ? 0.5 : 0.3,
                        zIndex: 0,
                        transition: 'opacity 0.5s ease-out'
                    }}
                />
            )}
            
            {/* Hover Glow Effect */}
            {isHovered && (
                <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(32, 178, 170, 0.15) 0%, transparent 70%)',
                        zIndex: 0,
                        animation: 'pulseGlow 2s ease-in-out infinite'
                    }}
                />
            )}
            <div 
                className={`${compact ? 'w-9 h-9 sm:w-10 sm:h-10 mb-2' : 'w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4'} rounded-lg flex items-center justify-center transition-all duration-500 ${
                    isVisible ? 'rotate-0 scale-100 float-animation' : 'rotate-12 scale-0'
                }`}
                style={{ 
                    backgroundColor: isHovered ? THEME.turquoiseDark : THEME.turquoiseLight,
                    transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: isHovered 
                        ? '0 8px 30px rgba(32, 178, 170, 0.4), 0 4px 15px rgba(32, 178, 170, 0.3)'
                        : isVisible 
                            ? '0 4px 20px rgba(32, 178, 170, 0.2)' 
                            : 'none',
                    transform: isHovered ? 'scale(1.15) rotate(5deg)' : 'scale(1) rotate(0deg)'
                }}
            >
                {icon}
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
                <h3 
                    className={`${compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'} font-semibold mb-2 transition-all duration-700 ${
                        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                    }`}
                    style={{ 
                        color: 'var(--theme-text-primary)',
                        transitionDelay: isVisible ? '0.1s' : '0s',
                        textShadow: isVisible ? '0 1px 3px rgba(0, 0, 0, 0.1)' : 'none'
                    }}
                >
                    {title}
                </h3>
                <p 
                    className={`${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} transition-all duration-700 ${
                        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                    }`}
                    style={{ 
                        color: 'var(--theme-text-secondary)',
                        transitionDelay: isVisible ? '0.2s' : '0s'
                    }}
                >
                    {description}
                </p>
            </div>
        </div>
    );
};

interface AnimatedSectionProps {
    children: React.ReactNode;
    delay?: number;
}

const AnimatedSection: React.FC<AnimatedSectionProps> = ({ children, delay = 0 }) => {
    const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay });

    return (
        <div
            ref={ref as React.RefObject<HTMLDivElement>}
            className={`transition-all duration-1000 ${
                isVisible 
                    ? 'opacity-100 translate-y-0 scale-100' 
                    : 'opacity-0 translate-y-16 scale-95'
            }`}
            style={{
                transition: 'all 1s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(64px) scale(0.95)',
                willChange: 'transform, opacity'
            }}
        >
            {children}
        </div>
    );
};

// -----------------------------------------------------------------------------
// الصفحة الرئيسية: AboutUs
// -----------------------------------------------------------------------------

export const AboutUs: React.FC = () => {
    const { isDark, toggleTheme } = useTheme();
    const { i18n, t } = useTranslation();

    // —— حالة النموذج والواجهة ——
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [trialName, setTrialName] = useState('');
    const [trialPhone, setTrialPhone] = useState('');
    const [trialRequiredBranches, setTrialRequiredBranches] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [currentLang, setCurrentLang] = useState<string>(i18n.language || 'ar');
    const [scannedRoomIndex, setScannedRoomIndex] = useState<number | null>(null);

    // —— بيانات مشتقة (رادار، نجوم) ——
    const radarRoomPositions = useMemo(() => {
        const { ROOM_COUNT, ROOM_RADIUS_MIN, ROOM_RADIUS_MAX, SEED } = RADAR_CONFIG;
        const rnd = (i: number) => (Math.sin(SEED + i * 1.5) * 0.5 + 0.5);
        const positions: Array<{ roomNum: number; angleDeg: number; x: number; y: number; colorIndex: number }> = [];
        for (let i = 0; i < ROOM_COUNT; i++) {
            const angleDeg = rnd(i) * 360;
            const radius = ROOM_RADIUS_MIN + rnd(i + 10) * (ROOM_RADIUS_MAX - ROOM_RADIUS_MIN);
            const rad = (angleDeg * Math.PI) / 180;
            positions.push({
                roomNum: 100 + i + 1,
                angleDeg,
                x: 50 + radius * Math.cos(rad),
                y: 50 - radius * Math.sin(rad),
                colorIndex: i % 4,
            });
        }
        return positions;
    }, []);

    const starsData = useMemo(() =>
        Array.from({ length: 50 }, (_, i) => ({
            key: `star-${i}`,
            delay: (i * 0.1) % 5,
            duration: 6 + (i % 4),
            size: 1 + ((i % 3) * 0.5),
            top: (i * 7.3) % 70,
            left: (i * 11.7) % 100,
        })),
        []
    );

    // —— تأثيرات (Parallax، إعادة توجيه، حقن أنيميشن) ——
    useEffect(() => {
        const handleScroll = () => {
            const scrolled = window.pageYOffset;
            document.querySelectorAll('.parallax-slow').forEach((el) => {
                (el as HTMLElement).style.transform = `translateY(${scrolled * 0.5}px)`;
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const host = window.location.hostname;
        if (
            host !== 'adora-hotels.com' &&
            host !== 'www.adora-hotels.com' &&
            !host.includes('localhost') &&
            !host.includes('127.0.0.1')
        ) {
            window.location.href = 'https://adora-hotels.com/about';
        }
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const styleId = 'about-us-radar-sweep';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `@keyframes radarSweepRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }`;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById(styleId);
            if (el) el.remove();
        };
    }, []);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const styleId = 'about-us-star-animation';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `@keyframes starTwinkle { 0% { opacity: 0.2; transform: scale(0.9); } 25% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 75% { opacity: 0.5; transform: scale(1); } 100% { opacity: 0.2; transform: scale(0.9); } }`;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById(styleId);
            if (el) el.remove();
        };
    }, []);

    useEffect(() => {
        const updateLanguage = () => setCurrentLang(i18n.language || 'ar');
        updateLanguage();
        i18n.on('languageChanged', updateLanguage);
        return () => i18n.off('languageChanged', updateLanguage);
    }, [i18n]);

    useEffect(() => {
        const interval = setInterval(() => {
            const t = (Date.now() / 1000) % RADAR_CONFIG.SCAN_DURATION_SEC;
            const sweepAngle = (t / RADAR_CONFIG.SCAN_DURATION_SEC) * 360;
            const half = RADAR_CONFIG.SWEEP_WEDGE_DEG / 2;
            let index: number | null = null;
            radarRoomPositions.forEach(({ angleDeg }, i) => {
                let diff = Math.abs(sweepAngle - angleDeg);
                if (diff > 180) diff = 360 - diff;
                if (diff < half) index = i;
            });
            setScannedRoomIndex(index);
        }, 100);
        return () => clearInterval(interval);
    }, [radarRoomPositions]);

    // —— معالجات الأحداث ——
    const handleLanguageChange = async (lang: 'ar' | 'en') => {
        await changeLanguage(lang);
        setCurrentLang(lang);
        setShowLangMenu(false);
    };
    const handleTrialSubmit = async () => {
        if (!trialName.trim() || !trialPhone.trim()) {
            toast.error(t('aboutUs.trialForm.namePhoneRequired'));
            return;
        }

        // ✅ Accept any phone number format for international users
        // Remove all non-digit characters except + for international format
        const cleanPhone = trialPhone.replace(/[^\d+]/g, '');
        
        // Only check if phone is not empty after cleaning
        if (!cleanPhone || cleanPhone.length < 3) {
            toast.error(t('aboutUs.trialForm.phoneInvalid'));
            return;
        }

        setIsSubmitting(true);
        try {
            // ✅ Architecture: Use service instead of direct Firebase call
            const result = await submitTrialRequest(trialName.trim(), cleanPhone, 'about_us_page', trialRequiredBranches);

            if (result.success) {
                setIsSuccess(true);
                toast.success(t('aboutUs.trialForm.success'));
                
                // Reset form after 2 seconds
                setTimeout(() => {
                    setShowTrialModal(false);
                    setIsSuccess(false);
                    setTrialName('');
                    setTrialPhone('');
                    setTrialRequiredBranches(1);
                }, 2000);
            } else {
                toast.error(result.error || t('aboutUs.trialForm.error'));
            }
        } catch (error) {
            toast.error(t('aboutUs.trialForm.error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div 
            className={`fixed inset-0 overflow-y-auto overflow-x-hidden ${isDark ? 'bg-slate-950' : 'bg-teal-50'}`}
            style={{ transition: 'background-color 1.5s ease-in-out', WebkitOverflowScrolling: 'touch' }}
        >
            {/* Premium Animated Background - Removed for unified experience */}
            
            {/* 🌙 DARK MODE - Night Sky with Stars */}
            <div className={`absolute inset-0 transition-all duration-[3000ms] ease-in-out ${isDark ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
                <div className={`absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-orange-900/20 via-purple-900/10 to-transparent transition-opacity duration-[3000ms] ${isDark ? 'opacity-100' : 'opacity-0'}`} style={{ 
                    maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.05) 5%, rgba(0,0,0,0.1) 10%, rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.35) 30%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.92) 80%, rgba(0,0,0,0.96) 90%, rgba(0,0,0,1) 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.05) 5%, rgba(0,0,0,0.1) 10%, rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.35) 30%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.65) 50%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.92) 80%, rgba(0,0,0,0.96) 90%, rgba(0,0,0,1) 100%)'
                }} />
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                    <div className="absolute top-20 right-1/4 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/10 via-indigo-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                </div>
                {/* ✅ Stars - Visible in Dark Mode with slow fade in/out */}
                <div className="absolute inset-0 stars-container" style={{ opacity: isDark ? 1 : 0, transition: 'opacity 3s ease-in-out', pointerEvents: 'none' }}>
                    {starsData.map((star) => (
                        <div
                            key={star.key}
                            className="absolute rounded-full bg-white star-twinkle"
                            style={{
                                width: `${star.size}px`,
                                height: `${star.size}px`,
                                top: `${star.top}%`,
                                left: `${star.left}%`,
                                animationName: 'starTwinkle',
                                animationDuration: `${star.duration}s`,
                                animationTimingFunction: 'ease-in-out',
                                animationIterationCount: 'infinite',
                                animationDelay: `${star.delay}s`,
                                willChange: 'opacity, transform'
                            }}
                        />
                    ))}
                </div>
                <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-white rounded-full animate-shooting-star" />
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-900/50 to-transparent" />
            </div>
            
            {/* Common elements */}
            <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${isDark ? 'opacity-30' : 'opacity-100'}`}>
                <div className="absolute top-0 left-0 w-64 h-64 corner-decoration corner-tl" />
                <div className="absolute bottom-0 right-0 w-64 h-64 corner-decoration corner-br" />
            </div>
            
            {/* Glowing accents - Gradual fade for purple background */}
            <div className={`absolute top-10 right-10 w-48 h-48 rounded-full blur-3xl glow-pulse transition-all duration-[3000ms] ${
                isDark 
                    ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10' 
                    : 'bg-gradient-to-br from-teal-400/30 to-cyan-400/20'
            }`} style={{
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.2) 60%, transparent 100%)'
            }} />
            <div className={`absolute bottom-20 left-10 w-56 h-56 rounded-full blur-3xl glow-pulse-delay transition-all duration-[3000ms] ${
                isDark 
                    ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10' 
                    : 'bg-gradient-to-br from-emerald-400/25 to-teal-400/15'
            }`} style={{
                maskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.2) 60%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.2) 60%, transparent 100%)'
            }} />
            <div className={`absolute top-1/2 left-1/4 w-32 h-32 rounded-full blur-2xl animate-pulse transition-all duration-[1500ms] ${
                isDark 
                    ? 'bg-gradient-to-br from-cyan-500/15 to-blue-500/10' 
                    : 'bg-gradient-to-br from-amber-400/20 to-orange-400/10'
            }`} />
            
            <div 
                className="min-h-screen h-full relative z-10 flex flex-col"
                style={{
                    color: 'var(--theme-text-primary)',
                    position: 'relative',
                    overflowX: 'hidden'
                }}
            >
            {/* ✅ ترويسة ثابتة — أزرار اللغة والثيم داخل الشريط */}
            <header
                className="fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300"
                style={{
                    background: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)'
                }}
            >
                <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-end gap-1.5">
                <div className="relative">
                    {/* Language Button */}
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className={`
                            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                            transition-all duration-200
                            font-medium text-xs
                            active:scale-95
                            ${isDark
                                ? 'bg-slate-800/80 backdrop-blur-sm text-white hover:bg-slate-700/90 border border-slate-700/50 shadow-lg'
                                : 'bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white border border-slate-200/50 shadow-lg'
                            }
                        `}
                        style={{
                            boxShadow: isDark 
                                ? '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(32, 178, 170, 0.1)'
                                : '0 4px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(32, 178, 170, 0.1)'
                        }}
                    >
                        <Languages className="w-4 h-4 flex-shrink-0" style={{ color: THEME.turquoise }} />
                        <span className="font-semibold">
                            {currentLang === 'ar' ? t('languages.arabic') : t('languages.english')}
                        </span>
                        <ChevronDown 
                            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${showLangMenu ? 'rotate-180' : ''}`}
                        />
                    </button>
                    
                    {/* Language Dropdown Menu - Professional Design */}
                    {showLangMenu && (
                        <>
                            <div 
                                className="fixed inset-0 z-40"
                                onClick={() => setShowLangMenu(false)}
                            />
                            <div 
                                className={`
                                    absolute top-full mt-1.5 right-0 rounded-lg shadow-2xl border z-50 min-w-[120px]
                                    overflow-hidden
                                    animate-in fade-in slide-in-from-top-2 duration-200
                                    ${isDark
                                        ? 'bg-slate-800/95 backdrop-blur-md border-slate-700/50'
                                        : 'bg-white/95 backdrop-blur-md border-slate-200/50'
                                    }
                                `}
                                style={{
                                    boxShadow: isDark
                                        ? '0 10px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(32, 178, 170, 0.1)'
                                        : '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                <button
                                    onClick={() => handleLanguageChange('ar')}
                                    className={`
                                        w-full px-3 py-2 text-right flex items-center justify-between gap-2 text-sm
                                        transition-all duration-150
                                        ${currentLang === 'ar'
                                            ? isDark
                                                ? 'bg-teal-600/20 text-teal-400 font-semibold'
                                                : 'bg-teal-600/10 text-teal-600 font-semibold'
                                            : isDark
                                                ? 'text-white/80 hover:bg-slate-700/50'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    <span>عربي</span>
                                    {currentLang === 'ar' && (
                                        <CheckCircle2 className="w-4 h-4" style={{ color: THEME.turquoise }} />
                                    )}
                                </button>
                                <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                                <button
                                    onClick={() => handleLanguageChange('en')}
                                    className={`
                                        w-full px-3 py-2 text-right flex items-center justify-between gap-2 text-sm
                                        transition-all duration-150
                                        ${currentLang === 'en'
                                            ? isDark
                                                ? 'bg-teal-600/20 text-teal-400 font-semibold'
                                                : 'bg-teal-600/10 text-teal-600 font-semibold'
                                            : isDark
                                                ? 'text-white/80 hover:bg-slate-700/50'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    <span>English</span>
                                    {currentLang === 'en' && (
                                        <CheckCircle2 className="w-4 h-4" style={{ color: THEME.turquoise }} />
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Theme Toggle Button */}
                <button
                    onClick={toggleTheme}
                    className={`
                        flex items-center justify-center w-8 h-8 rounded-lg
                        transition-all duration-300
                        active:scale-95
                        ${isDark
                            ? 'bg-slate-800/80 backdrop-blur-sm text-white hover:bg-slate-700/90 border border-slate-700/50 shadow-lg'
                            : 'bg-white/90 backdrop-blur-sm text-slate-700 hover:bg-white border border-slate-200/50 shadow-lg'
                        }
                    `}
                    style={{
                        boxShadow: isDark 
                            ? '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(32, 178, 170, 0.1)'
                            : '0 4px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(32, 178, 170, 0.1)',
                        transition: 'all 3s ease-in-out'
                    }}
                    title={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
                >
                    {isDark ? (
                        <Sun className="w-4 h-4 transition-all duration-1000" style={{ color: THEME.turquoise }} />
                    ) : (
                        <Moon className="w-4 h-4 transition-all duration-1000" style={{ color: THEME.turquoise }} />
                    )}
                </button>
                </div>
            </header>

            <div className="flex-1 flex flex-col pt-12 sm:pt-14">
            {/* Hero Section - Unified Background */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <Container>
                    <div className="text-center space-y-3 sm:space-y-4 hero-content" style={{ position: 'relative', zIndex: 1 }}>
                        {/* Logo Container - Mobile Responsive, Centered */}
                        <div 
                            className="flex justify-center items-center mb-3 sm:mb-4 relative mx-auto"
                            style={{ 
                                width: 'clamp(200px, 50vw, 300px)',
                                height: 'clamp(200px, 50vw, 300px)',
                                position: 'relative',
                                isolation: 'isolate'
                            }}
                        >
                            {/* Main Logo - Centered First (Base Layer) */}
                            <div
                                className="relative z-10"
                                style={{
                                    width: 'clamp(100px, 35vw, 180px)',
                                    height: 'clamp(100px, 35vw, 180px)',
                                    position: 'absolute',
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <img
                                    src="/adora-logo.png"
                                    alt="Adora Logo"
                                    className="logo-float logo-crisp"
                                    style={{ 
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        filter: isDark 
                                            ? 'drop-shadow(0 10px 30px rgba(251, 191, 36, 0.3))' 
                                            : 'drop-shadow(0 10px 30px rgba(20, 184, 166, 0.4))',
                                        transition: 'filter 1s ease-in-out',
                                        imageRendering: 'auto',
                                        WebkitBackfaceVisibility: 'hidden',
                                        backfaceVisibility: 'hidden',
                                        transform: 'translateZ(0)',
                                        WebkitTransform: 'translateZ(0)',
                                        WebkitFontSmoothing: 'antialiased',
                                        MozOsxFontSmoothing: 'grayscale'
                                    }}
                                    loading="eager"
                                    decoding="sync"
                                />
                            </div>

                            {/* Glow effect behind logo */}
                            <div 
                                className="absolute rounded-full blur-3xl animate-pulse transition-colors duration-1000"
                                style={{ 
                                    width: 'clamp(120px, 40vw, 200px)', 
                                    height: 'clamp(120px, 40vw, 200px)',
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: isDark ? 'rgba(20, 184, 166, 0.2)' : 'rgba(20, 184, 166, 0.3)',
                                    animationDuration: '4s'
                                }}
                            />
                            
                            {/* 🪐 Orbital Rings with Planets - Close to Logo */}
                            <div 
                                className="absolute pointer-events-none"
                                style={{ 
                                    width: '100%', 
                                    height: '100%',
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)'
                                }}
                            >
                                {/* Orbit 1 - Closest (120% of logo size) */}
                                <div 
                                    className="absolute rounded-full animate-orbit-1"
                                    style={{ 
                                        width: 'clamp(120px, 42vw, 216px)', 
                                        height: 'clamp(120px, 42vw, 216px)',
                                        border: `1px dashed ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(13, 148, 136, 0.35)'}`,
                                        left: '50%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        transformOrigin: 'center center'
                                    }}
                                >
                                    <div 
                                        className={`absolute w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isDark ? 'bg-amber-400/70' : 'bg-teal-500/70'}`}
                                        style={{ 
                                            top: '0%', 
                                            left: '50%', 
                                            transform: 'translate(-50%, -50%)',
                                            boxShadow: `0 0 8px ${isDark ? 'rgba(251, 191, 36, 0.5)' : 'rgba(20, 184, 166, 0.5)'}`
                                        }}
                                    />
                                </div>
                                
                                {/* Orbit 2 - Middle (140% of logo size) */}
                                <div 
                                    className="absolute rounded-full animate-orbit-2"
                                    style={{ 
                                        width: 'clamp(140px, 49vw, 252px)', 
                                        height: 'clamp(140px, 49vw, 252px)',
                                        border: `1px dashed ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(13, 148, 136, 0.25)'}`,
                                        left: '50%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        transformOrigin: 'center center'
                                    }}
                                >
                                    <div 
                                        className={`absolute w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${isDark ? 'bg-cyan-400/60' : 'bg-cyan-600/60'}`}
                                        style={{ 
                                            top: '50%', 
                                            right: '0%', 
                                            transform: 'translate(50%, -50%)',
                                            boxShadow: `0 0 8px ${isDark ? 'rgba(6, 182, 212, 0.5)' : 'rgba(8, 145, 178, 0.5)'}`
                                        }}
                                    />
                                </div>
                                
                                {/* Orbit 3 - Outer (160% of logo size) */}
                                <div 
                                    className="absolute rounded-full animate-orbit-3"
                                    style={{ 
                                        width: 'clamp(160px, 56vw, 288px)', 
                                        height: 'clamp(160px, 56vw, 288px)',
                                        border: `1px dashed ${isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(13, 148, 136, 0.18)'}`,
                                        left: '50%',
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        transformOrigin: 'center center'
                                    }}
                                >
                                    <div 
                                        className={`absolute w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isDark ? 'bg-purple-400/50' : 'bg-purple-500/50'}`}
                                        style={{ 
                                            bottom: '0%', 
                                            left: '50%', 
                                            transform: 'translate(-50%, 50%)',
                                            boxShadow: `0 0 6px ${isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`
                                        }}
                                    />
                                </div>
                            </div>
                            
                            {/* Sparkle effects - Close to Logo */}
                            <div 
                                className={`absolute rounded-full animate-sparkle ${isDark ? 'bg-amber-300' : 'bg-yellow-400'}`}
                                style={{ 
                                    top: 'calc(50% - clamp(50px, 17.5vw, 90px) - 8px)',
                                    right: 'calc(50% - clamp(50px, 17.5vw, 90px) + 8px)',
                                    width: 'clamp(8px, 2vw, 16px)',
                                    height: 'clamp(8px, 2vw, 16px)',
                                    boxShadow: `0 0 12px ${isDark ? 'rgba(251, 191, 36, 0.6)' : 'rgba(250, 204, 21, 0.6)'}`
                                }}
                            />
                            <div 
                                className={`absolute rounded-full animate-sparkle-delay ${isDark ? 'bg-orange-300' : 'bg-cyan-400'}`}
                                style={{ 
                                    top: 'calc(50% - clamp(50px, 17.5vw, 90px) + clamp(25px, 8.75vw, 45px))',
                                    left: 'calc(50% - clamp(50px, 17.5vw, 90px) - 8px)',
                                    width: 'clamp(6px, 1.5vw, 12px)',
                                    height: 'clamp(6px, 1.5vw, 12px)',
                                    boxShadow: `0 0 10px ${isDark ? 'rgba(253, 186, 116, 0.5)' : 'rgba(34, 211, 238, 0.5)'}`
                                }}
                            />
                            <div 
                                className={`absolute rounded-full animate-sparkle-delay-2 ${isDark ? 'bg-yellow-200' : 'bg-teal-300'}`}
                                style={{ 
                                    bottom: 'calc(50% - clamp(50px, 17.5vw, 90px) - 8px)',
                                    right: 'calc(50% - clamp(50px, 17.5vw, 90px) + clamp(25px, 8.75vw, 45px))',
                                    width: 'clamp(6px, 1.5vw, 12px)',
                                    height: 'clamp(6px, 1.5vw, 12px)',
                                    boxShadow: `0 0 10px ${isDark ? 'rgba(254, 240, 138, 0.5)' : 'rgba(94, 234, 212, 0.5)'}`
                                }}
                            />
                        </div>
                        <AnimatedSection delay={100}>
                            <h1 
                                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 px-4"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                {currentLang === 'ar' ? (
                                    <>نظام ادورا - <span key="adora" style={{ color: THEME.turquoise, fontWeight: '700', letterSpacing: '1px' }}>ADORA</span> لإدارة الفنادق</>
                                ) : (
                                    <>Adora System - <span key="adora" style={{ color: THEME.turquoise, fontWeight: '700', letterSpacing: '1px' }}>ADORA</span> Hotel Management</>
                                )}
                            </h1>
                        </AnimatedSection>
                        <AnimatedSection delay={200}>
                            <p 
                                className="text-base sm:text-lg md:text-xl lg:text-2xl max-w-3xl mx-auto px-4 leading-relaxed"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                            {t('aboutUs.hero.subtitle')}
                            <br className="hidden sm:block" />
                            <span className="sm:hidden"> </span>
                            {currentLang === 'ar' ? (
                                <>يوفر <span style={{ color: THEME.turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight1')}</span> ويزيد من <span style={{ color: THEME.turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight2')}</span></>
                            ) : (
                                <>Saves <span style={{ color: THEME.turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight1')}</span> and increases <span style={{ color: THEME.turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight2')}</span></>
                            )}
                            </p>
                        </AnimatedSection>
                        <AnimatedSection delay={300}>
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 sm:mt-5 px-4">
                                <button
                                    onClick={() => setShowTrialModal(true)}
                                    className="px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 flex items-center gap-2 hover:scale-110 hover:shadow-2xl active:scale-95 shadow-lg group"
                                    style={{ 
                                        backgroundColor: THEME.turquoise,
                                        transform: 'translateY(0)',
                                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                                        e.currentTarget.style.boxShadow = '0 20px 40px rgba(32, 178, 170, 0.4), 0 0 0 1px rgba(32, 178, 170, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(32, 178, 170, 0.3)';
                                    }}
                                >
                                    {t('aboutUs.hero.ctaButton')}
                                    <Send className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
                                </button>
                            </div>
                        </AnimatedSection>
                    </div>
                </Container>
            </Section>

            {/* Statistics Section - Adora by the Numbers */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative'
                }}
            >
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center mb-3 sm:mb-4 px-4">
                            <div 
                                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center transition-all duration-500 hover:scale-110 hover:rotate-12"
                                style={{ 
                                    backgroundColor: THEME.turquoiseLight,
                                    boxShadow: '0 4px 20px rgba(32, 178, 170, 0.2)',
                                    animation: 'bounceIn 0.8s ease-out'
                                }}
                            >
                                <BarChart3 className="w-8 h-8" style={{ color: THEME.turquoise }} />
                            </div>
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                {t('aboutUs.statistics.title')}
                            </h2>
                            <p 
                                className="text-base sm:text-lg"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                                {t('aboutUs.statistics.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-4">
                        {[
                            { key: 'timeSaving', icon: <Clock className="w-6 h-6" style={{ color: THEME.turquoise }} /> },
                            { key: 'guestSatisfaction', icon: <Star className="w-6 h-6" style={{ color: THEME.turquoise }} /> },
                            { key: 'responseTime', icon: <Zap className="w-6 h-6" style={{ color: THEME.turquoise }} /> },
                            { key: 'efficiency', icon: <TrendingUp className="w-6 h-6" style={{ color: THEME.turquoise }} /> },
                            { key: 'cloudBased', icon: <Globe className="w-6 h-6" style={{ color: THEME.turquoise }} /> }
                        ].map((stat, index) => {
                            const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay: index * 100 });
                            return (
                                <div
                                    key={stat.key}
                                    ref={ref as React.RefObject<HTMLDivElement>}
                                    className={`p-6 rounded-xl text-center transition-all duration-700 ${
                                        isVisible 
                                            ? 'opacity-100 translate-y-0 scale-100' 
                                            : 'opacity-0 translate-y-12 scale-95'
                                    } hover:scale-105 hover:shadow-2xl hover:-translate-y-2 glass-hover`}
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(48px) scale(0.95)'
                                    }}
                                >
                                    <div className="mb-3 flex justify-center">{stat.icon}</div>
                                    <div 
                                        className="text-3xl sm:text-4xl font-bold mb-2"
                                        style={{ color: THEME.turquoise }}
                                    >
                                        {t(`aboutUs.statistics.${stat.key}.value`)}
                                    </div>
                                    <div 
                                        className="text-sm sm:text-base"
                                        style={{ color: 'var(--theme-text-secondary)' }}
                                    >
                                        {t(`aboutUs.statistics.${stat.key}.label`)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Container>
            </Section>

            {/* Features Section - Unified Background with gradual purple fade - NO DIVIDING LINE */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative'
                }}
            >
                {/* Gradual fade overlay from purple to transparent - Ultra smooth gradient, no sharp line */}
                <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: isDark 
                            ? 'linear-gradient(to bottom, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.12) 8%, rgba(139, 92, 246, 0.09) 16%, rgba(139, 92, 246, 0.06) 24%, rgba(139, 92, 246, 0.04) 32%, rgba(139, 92, 246, 0.03) 40%, rgba(139, 92, 246, 0.02) 48%, rgba(139, 92, 246, 0.015) 56%, rgba(139, 92, 246, 0.01) 64%, rgba(139, 92, 246, 0.005) 72%, transparent 85%)'
                            : 'linear-gradient(to bottom, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.06) 8%, rgba(139, 92, 246, 0.04) 16%, rgba(139, 92, 246, 0.03) 24%, rgba(139, 92, 246, 0.02) 32%, rgba(139, 92, 246, 0.015) 40%, rgba(139, 92, 246, 0.01) 48%, rgba(139, 92, 246, 0.005) 56%, transparent 70%)',
                        transition: 'opacity 3s ease-in-out',
                        opacity: isDark ? 1 : 0.5,
                        maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 5%, rgba(0,0,0,0.9) 10%, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0.1) 90%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 5%, rgba(0,0,0,0.9) 10%, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.2) 80%, rgba(0,0,0,0.1) 90%, transparent 100%)'
                    }}
                />
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center mb-3 sm:mb-4 px-4">
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                {t('aboutUs.features.title', { adora: <span key="adora" style={{ color: THEME.turquoise }}>أدورا</span> })}
                            </h2>
                            <p 
                                className="text-base sm:text-lg"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                                {t('aboutUs.features.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-3 px-4">
                        {/* 4 كروت في الصف على الشاشات الكبيرة — حجم compact */}
                        <FeatureCard
                            compact
                            icon={<Users className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.reception.title')}
                            description={t('aboutUs.features.reception.desc')}
                            delay={0}
                        />
                        <FeatureCard
                            compact
                            icon={<Bed className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.housekeeping.title')}
                            description={t('aboutUs.features.housekeeping.desc')}
                            delay={50}
                        />
                        <FeatureCard
                            compact
                            icon={<Luggage className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.bellman.title')}
                            description={t('aboutUs.features.bellman.desc')}
                            delay={100}
                        />
                        <FeatureCard
                            compact
                            icon={<Wrench className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.maintenance.title')}
                            description={t('aboutUs.features.maintenance.desc')}
                            delay={150}
                        />
                        <FeatureCard
                            compact
                            icon={<ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.procurement.title')}
                            description={t('aboutUs.features.procurement.desc')}
                            delay={200}
                        />
                        <FeatureCard
                            compact
                            icon={<Coffee className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.coffee.title')}
                            description={t('aboutUs.features.coffee.desc')}
                            delay={250}
                        />
                        <FeatureCard
                            compact
                            icon={<MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.chat.title')}
                            description={t('aboutUs.features.chat.desc')}
                            delay={300}
                        />
                        <FeatureCard
                            compact
                            icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.points.title')}
                            description={t('aboutUs.features.points.desc')}
                            delay={350}
                        />
                        <FeatureCard
                            compact
                            icon={<Star className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.loyalty.title')}
                            description={t('aboutUs.features.loyalty.desc')}
                            delay={400}
                        />
                        <FeatureCard
                            compact
                            icon={<BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.reports.title')}
                            description={t('aboutUs.features.reports.desc')}
                            delay={450}
                        />
                        <FeatureCard
                            compact
                            icon={<Globe className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.multiBranch.title')}
                            description={t('aboutUs.features.multiBranch.desc')}
                            delay={500}
                        />
                        <FeatureCard
                            compact
                            icon={<Bell className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: THEME.turquoise }} />}
                            title={t('aboutUs.features.alerts.title')}
                            description={t('aboutUs.features.alerts.desc')}
                            delay={550}
                        />
                    </div>
                </Container>
            </Section>

            {/* Why Adora Section - What Sets Us Apart */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative'
                }}
            >
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center mb-3 sm:mb-4 px-4">
                            <div 
                                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center transition-all duration-500 hover:scale-110 hover:rotate-12"
                                style={{ 
                                    backgroundColor: THEME.turquoiseLight,
                                    boxShadow: '0 4px 20px rgba(32, 178, 170, 0.2)',
                                    animation: 'bounceIn 0.8s ease-out'
                                }}
                            >
                                <Award className="w-8 h-8" style={{ color: THEME.turquoise }} />
                            </div>
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                {t('aboutUs.whyAdora.title')}
                            </h2>
                            <p 
                                className="text-base sm:text-lg"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                                {t('aboutUs.whyAdora.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4">
                        {[
                            { key: 'local', icon: <Globe className="w-5 h-5" style={{ color: THEME.turquoise }} /> },
                            { key: 'noCommissions', icon: <CreditCard className="w-5 h-5" style={{ color: THEME.turquoise }} /> },
                            { key: 'support', icon: <Phone className="w-5 h-5" style={{ color: THEME.turquoise }} /> },
                            { key: 'training', icon: <Users className="w-5 h-5" style={{ color: THEME.turquoise }} /> },
                            { key: 'updates', icon: <Sparkles className="w-5 h-5" style={{ color: THEME.turquoise }} /> },
                            { key: 'integration', icon: <Database className="w-5 h-5" style={{ color: THEME.turquoise }} /> }
                        ].map((item, index) => {
                            const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay: index * 100 });
                            return (
                                <div
                                    key={item.key}
                                    ref={ref as React.RefObject<HTMLDivElement>}
                                    className={`p-5 rounded-lg flex items-start gap-3 transition-all duration-700 ${
                                        isVisible 
                                            ? 'opacity-100 translate-x-0 scale-100' 
                                            : 'opacity-0 translate-x-12 scale-95'
                                    } hover:scale-[1.03] hover:shadow-xl hover:-translate-y-1 glass-hover`}
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(48px) scale(0.95)'
                                    }}
                                >
                                    <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                                    <div>
                                        <h3 
                                            className="font-semibold mb-1"
                                            style={{ color: 'var(--theme-text-primary)' }}
                                        >
                                            {t(`aboutUs.whyAdora.${item.key}.title`)}
                                        </h3>
                                        <p style={{ color: 'var(--theme-text-secondary)' }}>
                                            {t(`aboutUs.whyAdora.${item.key}.desc`)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Container>
            </Section>

            {/* Before/After Comparison Section */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative'
                }}
            >
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center mb-3 sm:mb-4 px-4">
                            <div 
                                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center transition-all duration-500 hover:scale-110 hover:rotate-12"
                                style={{ 
                                    backgroundColor: THEME.turquoiseLight,
                                    boxShadow: '0 4px 20px rgba(32, 178, 170, 0.2)',
                                    animation: 'bounceIn 0.8s ease-out'
                                }}
                            >
                                <ArrowRight className="w-8 h-8" style={{ color: THEME.turquoise }} />
                            </div>
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                {t('aboutUs.beforeAfter.title')}
                            </h2>
                            <p 
                                className="text-base sm:text-lg"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                                {t('aboutUs.beforeAfter.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="max-w-4xl mx-auto space-y-4 px-4">
                        {[
                            { key: 'paperwork' },
                            { key: 'feedback' },
                            { key: 'tracking' },
                            { key: 'delays' },
                            { key: 'reports' }
                        ].map((item, index) => {
                            const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay: index * 100 });
                            return (
                                <div
                                    key={item.key}
                                    ref={ref as React.RefObject<HTMLDivElement>}
                                    className={`p-5 rounded-xl transition-all duration-700 ${
                                        isVisible 
                                            ? 'opacity-100 translate-x-0 scale-100' 
                                            : 'opacity-0 translate-x-12 scale-95'
                                    } hover:scale-[1.02] hover:shadow-xl glass-hover`}
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(48px) scale(0.95)'
                                    }}
                                >
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="flex-1 text-center sm:text-right">
                                            <div 
                                                className="text-base sm:text-lg font-semibold mb-1"
                                                style={{ color: isDark ? 'rgba(239, 68, 68, 0.9)' : '#dc2626' }}
                                            >
                                                ❌ {t(`aboutUs.beforeAfter.${item.key}.before`)}
                                            </div>
                                        </div>
                                        <ArrowRight className="w-6 h-6 flex-shrink-0" style={{ color: THEME.turquoise }} />
                                        <div className="flex-1 text-center sm:text-left">
                                            <div 
                                                className="text-base sm:text-lg font-semibold mb-1"
                                                style={{ color: THEME.turquoise }}
                                            >
                                                ✅ {t(`aboutUs.beforeAfter.${item.key}.after`)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Container>
            </Section>

            {/* Testimonials Section - What They Say About Adora */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative'
                }}
            >
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center mb-3 sm:mb-4 px-4">
                            <div 
                                className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center transition-all duration-500 hover:scale-110 hover:rotate-12"
                                style={{ 
                                    backgroundColor: THEME.turquoiseLight,
                                    boxShadow: '0 4px 20px rgba(32, 178, 170, 0.2)',
                                    animation: 'bounceIn 0.8s ease-out'
                                }}
                            >
                                <Heart className="w-8 h-8" style={{ color: THEME.turquoise }} />
                            </div>
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                {t('aboutUs.testimonials.title')}
                            </h2>
                            <p 
                                className="text-base sm:text-lg"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                                {t('aboutUs.testimonials.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4">
                        {[1, 2, 3].map((num, index) => {
                            const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay: index * 150 });
                            return (
                                <div
                                    key={num}
                                    ref={ref as React.RefObject<HTMLDivElement>}
                                    className={`p-6 rounded-xl transition-all duration-700 ${
                                        isVisible 
                                            ? 'opacity-100 translate-y-0 scale-100' 
                                            : 'opacity-0 translate-y-12 scale-95'
                                    } hover:scale-105 hover:shadow-2xl hover:-translate-y-2 glass-hover`}
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(48px) scale(0.95)'
                                    }}
                                >
                                    <div className="flex items-start gap-3 mb-4">
                                        <div 
                                            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: THEME.turquoiseLight }}
                                        >
                                            <Star className="w-6 h-6" style={{ color: THEME.turquoise }} />
                                        </div>
                                        <div className="flex-1">
                                            <div 
                                                className="text-sm leading-relaxed mb-3"
                                                style={{ color: 'var(--theme-text-secondary)' }}
                                            >
                                                "{t(`aboutUs.testimonials.testimonial${num}.text`)}"
                                            </div>
                                            <div 
                                                className="text-sm font-semibold"
                                                style={{ color: 'var(--theme-text-primary)' }}
                                            >
                                                {t(`aboutUs.testimonials.testimonial${num}.author`)}
                                            </div>
                                            <div 
                                                className="text-xs"
                                                style={{ color: 'var(--theme-text-tertiary)' }}
                                            >
                                                {t(`aboutUs.testimonials.testimonial${num}.location`)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Container>
            </Section>

            {/* Trust Indicators Section */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative'
                }}
            >
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center mb-3 sm:mb-4 px-4">
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                {t('aboutUs.trustIndicators.title')}
                            </h2>
                            <p 
                                className="text-base sm:text-lg"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                                {t('aboutUs.trustIndicators.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 max-w-3xl mx-auto">
                        {[
                            { key: 'secure', icon: <Shield className="w-6 h-6" style={{ color: THEME.turquoise }} /> },
                            { key: 'local', icon: <Globe className="w-6 h-6" style={{ color: THEME.turquoise }} /> },
                            { key: 'support', icon: <Phone className="w-6 h-6" style={{ color: THEME.turquoise }} /> },
                            { key: 'satisfaction', icon: <CheckCircle2 className="w-6 h-6" style={{ color: THEME.turquoise }} /> }
                        ].map((item, index) => {
                            const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay: index * 100 });
                            return (
                                <div
                                    key={item.key}
                                    ref={ref as React.RefObject<HTMLDivElement>}
                                    className={`p-5 rounded-xl text-center transition-all duration-700 ${
                                        isVisible 
                                            ? 'opacity-100 translate-y-0 scale-100' 
                                            : 'opacity-0 translate-y-12 scale-95'
                                    } hover:scale-105 hover:shadow-xl glass-hover`}
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(48px) scale(0.95)'
                                    }}
                                >
                                    <div className="mb-3 flex justify-center">{item.icon}</div>
                                    <div 
                                        className="text-sm sm:text-base font-semibold"
                                        style={{ color: 'var(--theme-text-primary)' }}
                                    >
                                        {t(`aboutUs.trustIndicators.${item.key}`)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Container>
            </Section>

            {/* Security Section — فوق الرادار، 3 في الصف */}
            <Section style={{ background: 'transparent' }}>
                <Container>
                    <div className="max-w-5xl mx-auto">
                        <AnimatedSection delay={0}>
                            <div className="text-center mb-2 sm:mb-3">
                                <div 
                                    className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                                    style={{ backgroundColor: THEME.turquoiseLight, boxShadow: '0 2px 12px rgba(32, 178, 170, 0.2)' }}
                                >
                                    <Lock className="w-5 h-5" style={{ color: THEME.turquoise }} />
                                </div>
                                <h2 
                                    className="text-lg sm:text-xl font-bold mb-1"
                                    style={{ color: 'var(--theme-text-primary)' }}
                                >
                                    {t('aboutUs.security.title')}
                                </h2>
                                <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                    {t('aboutUs.security.subtitle')}
                                </p>
                            </div>
                        </AnimatedSection>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 px-2">
                            {[
                                { titleKey: 'aboutUs.security.tenantIsolation.title', descKey: 'aboutUs.security.tenantIsolation.desc' },
                                { titleKey: 'aboutUs.security.rbac.title', descKey: 'aboutUs.security.rbac.desc' },
                                { titleKey: 'aboutUs.security.encryptedTokens.title', descKey: 'aboutUs.security.encryptedTokens.desc' },
                                { titleKey: 'aboutUs.security.atomicOps.title', descKey: 'aboutUs.security.atomicOps.desc' },
                                { titleKey: 'aboutUs.security.auditLogs.title', descKey: 'aboutUs.security.auditLogs.desc' },
                                { titleKey: 'aboutUs.security.monitoring.title', descKey: 'aboutUs.security.monitoring.desc' }
                            ].map((item, index) => {
                                const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay: index * 80 });
                                return (
                                    <div
                                        key={index}
                                        ref={ref as React.RefObject<HTMLDivElement>}
                                        className={`p-2.5 rounded-lg flex items-start gap-2 transition-all duration-500 ${
                                            isVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-8 scale-95'
                                        } hover:scale-[1.02] hover:shadow-lg`}
                                        style={{
                                            background: 'var(--theme-bg-tertiary)',
                                            border: '1px solid var(--theme-border-primary)',
                                            transition: 'all 0.5s ease',
                                            transform: isVisible ? 'translateX(0) scale(1)' : 'translateX(24px) scale(0.95)'
                                        }}
                                    >
                                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: THEME.turquoise }} />
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold mb-0.5" style={{ color: 'var(--theme-text-primary)' }}>
                                                {t(item.titleKey)}
                                            </h3>
                                            <p className="text-xs leading-snug" style={{ color: 'var(--theme-text-secondary)' }}>
                                                {t(item.descKey)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Container>
            </Section>

            {/* CTA Section - 2026 Premium Design (جاهز للبدء؟ + الرادار) */}
            <Section 
                style={{
                    background: isDark 
                        ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 0.95) 100%)'
                        : 'linear-gradient(180deg, #fefefe 0%, #fafafa 100%)',
                    position: 'relative',
                    overflow: 'visible',
                    minHeight: 'clamp(320px, 46vh, 500px)',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    paddingTop: 'clamp(16px, 3vw, 28px)',
                    paddingBottom: 'clamp(16px, 3vw, 28px)'
                }}
            >
                <Container>
                    {/* CTA + Radar — توسيط متوازن، بدون تراكب */}
                    <div 
                        className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center justify-items-center"
                        style={{ isolation: 'isolate' }}
                    >
                        {/* عمود النص — منتصف */}
                        <div 
                            className="lg:col-span-6 w-full max-w-xl flex flex-col items-center justify-center text-center space-y-3 lg:space-y-4"
                            style={{ position: 'relative', zIndex: 1 }}
                        >
                            <AnimatedSection delay={0}>
                                <div className="space-y-2 lg:space-y-3">
                                    <h2 
                                        className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
                                        style={{ 
                                            color: 'var(--theme-text-primary)',
                                            background: 'linear-gradient(135deg, var(--theme-text-primary) 0%, var(--theme-text-secondary) 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text'
                                        }}
                                    >
                                        {t('aboutUs.cta.title')}
                                    </h2>
                                    <p 
                                        className="text-base sm:text-lg md:text-xl lg:text-2xl font-medium leading-relaxed max-w-2xl mx-auto"
                                        style={{ 
                                            color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'var(--theme-text-secondary)',
                                            textShadow: isDark ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none'
                                        }}
                                    >
                                        {t('aboutUs.cta.subtitle')}
                                    </p>
                                </div>
                            </AnimatedSection>

                            {/* زر طلب التجربة — في المنتصف */}
                            <div className="flex justify-center pt-2">
                                <button
                                    type="button"
                                    aria-label={t('aboutUs.cta.button') || undefined}
                                    onClick={() => setShowTrialModal(true)}
                                    className="group relative px-8 py-4 rounded-2xl font-semibold text-white transition-all duration-500 flex items-center gap-3 overflow-hidden"
                                    style={{
                                        background: `linear-gradient(135deg, ${THEME.turquoise} 0%, #0D9488 100%)`,
                                        boxShadow: `0 8px 32px rgba(20, 184, 166, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset`,
                                        transform: 'translateY(0)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                                        e.currentTarget.style.boxShadow = '0 16px 48px rgba(20, 184, 166, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.2) inset';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                                        e.currentTarget.style.boxShadow = '0 8px 32px rgba(20, 184, 166, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset';
                                    }}
                                >
                                    {/* Shimmer Effect */}
                                    <span 
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                        style={{
                                            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
                                            transform: 'translateX(-100%)',
                                            animation: 'shimmer2026 2s infinite'
                                        }}
                                    />
                                    <span className="relative z-10 flex items-center gap-3">
                                        {t('aboutUs.cta.button')}
                                        <Send className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-110" />
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* عمود الرادار — الدائرة كاملة ظاهرة بدون قص */}
                        <div 
                            className="lg:col-span-6 w-full flex items-center justify-center"
                            style={{ position: 'relative', zIndex: 0, isolation: 'isolate' }}
                        >
                            <div 
                                className="relative w-full flex flex-col items-center justify-center"
                                style={{
                                    minHeight: 'clamp(154px, min(26.6vw, 26.6vh), 252px)',
                                    maxHeight: 'clamp(154px, min(26.6vw, 26.6vh), 252px)',
                                    padding: 'clamp(6px, 1.2vw, 12px)'
                                }}
                                aria-hidden="true"
                            >
                                <div 
                                    className="radar-dome radar-dome-square"
                                    style={{
                                        position: 'relative',
                                        flexShrink: 0,
                                        isolation: 'isolate',
                                        width: `clamp(${280 * RADAR_CONFIG.SIZE_SCALE}px, min(${48 * RADAR_CONFIG.SIZE_SCALE}vw, ${48 * RADAR_CONFIG.SIZE_SCALE}vh), ${480 * RADAR_CONFIG.SIZE_SCALE}px)`,
                                        height: `clamp(${280 * RADAR_CONFIG.SIZE_SCALE}px, min(${48 * RADAR_CONFIG.SIZE_SCALE}vw, ${48 * RADAR_CONFIG.SIZE_SCALE}vh), ${480 * RADAR_CONFIG.SIZE_SCALE}px)`,
                                        minWidth: `clamp(${280 * RADAR_CONFIG.SIZE_SCALE}px, min(${48 * RADAR_CONFIG.SIZE_SCALE}vw, ${48 * RADAR_CONFIG.SIZE_SCALE}vh), ${480 * RADAR_CONFIG.SIZE_SCALE}px)`,
                                        minHeight: `clamp(${280 * RADAR_CONFIG.SIZE_SCALE}px, min(${48 * RADAR_CONFIG.SIZE_SCALE}vw, ${48 * RADAR_CONFIG.SIZE_SCALE}vh), ${480 * RADAR_CONFIG.SIZE_SCALE}px)`,
                                        borderRadius: '50%',
                                        background: isDark
                                            ? 'radial-gradient(circle at 50% 50%, #0f172a 0%, #1e293b 55%, #334155 100%)'
                                            : 'radial-gradient(circle at 50% 50%, #f8fafc 0%, #f0fdfa 50%, rgba(20, 184, 166, 0.15) 100%)',
                                        border: `2px solid ${isDark ? 'rgba(20, 184, 166, 0.5)' : 'rgba(13, 148, 136, 0.6)'}`,
                                        boxShadow: isDark
                                            ? '0 0 0 1px rgba(0,0,0,0.3) inset, 0 20px 50px rgba(0,0,0,0.4)'
                                            : '0 0 0 1px rgba(255,255,255,0.5) inset, 0 20px 50px rgba(20, 184, 166, 0.15)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* دوائر متحدة المركز */}
                                    {Array.from({ length: RADAR_CONFIG.RINGS }, (_, i) => {
                                        const r = ((i + 1) / RADAR_CONFIG.RINGS) * 50;
                                        return (
                                            <div
                                                key={`ring-${i}`}
                                                style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    width: `${r * 2}%`,
                                                    height: `${r * 2}%`,
                                                    marginLeft: `-${r}%`,
                                                    marginTop: `-${r}%`,
                                                    borderRadius: '50%',
                                                    border: `1px solid ${isDark ? 'rgba(20, 184, 166, 0.45)' : 'rgba(13, 148, 136, 0.6)'}`,
                                                    zIndex: 1
                                                }}
                                            />
                                        );
                                    })}
                                    {/* خطوط شعاعية */}
                                    {Array.from({ length: RADAR_CONFIG.RAYS }, (_, i) => {
                                        const angle = (i / RADAR_CONFIG.RAYS) * 360;
                                        return (
                                            <div
                                                key={`ray-${i}`}
                                                style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    width: '2px',
                                                    height: '50%',
                                                    transformOrigin: '50% 100%',
                                                    transform: `translate(-50%, -100%) rotate(${angle}deg)`,
                                                    background: `linear-gradient(to top, ${isDark ? 'rgba(20, 184, 166, 0.5)' : 'rgba(255,255,255,0.5)'}, transparent)`,
                                                    zIndex: 1
                                                }}
                                            />
                                        );
                                    })}
                                    {/* نقطة المركز — في الفاتح: تيل بدون إطار؛ في الداكن: أبيض */}
                                    <div
                                        className="radar-center-dot"
                                        role="presentation"
                                        tabIndex={-1}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            width: '8px',
                                            height: '8px',
                                            marginLeft: '-4px',
                                            marginTop: '-4px',
                                            borderRadius: '50%',
                                            outline: 'none',
                                            border: 'none',
                                            background: isDark ? 'rgba(255,255,255,0.95)' : 'rgba(13, 148, 136, 0.95)',
                                            boxShadow: isDark
                                                ? '0 0 12px rgba(255,255,255,0.9), 0 0 24px rgba(255,255,255,0.5)'
                                                : '0 0 12px rgba(13, 148, 136, 0.8), 0 0 24px rgba(13, 148, 136, 0.4)',
                                            zIndex: 6
                                        }}
                                    />
                                    {/* شعاع wedge دوّار — ساطع أماماً وظل خلف المؤشر */}
                                    <div
                                        className="radar-sweep-wedge radar-sweep-wedge-rotate"
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            borderRadius: '50%',
                                            background: isDark
                                                ? `conic-gradient(from 90deg, rgba(20, 184, 166, 0.15) 0deg, rgba(20, 184, 166, 0.35) 10deg, rgba(20, 184, 166, 0.5) 20deg, rgba(20, 184, 166, 0.7) ${RADAR_CONFIG.SWEEP_WEDGE_DEG}deg, transparent ${RADAR_CONFIG.SWEEP_WEDGE_DEG}deg, transparent 360deg)`
                                                : `conic-gradient(from 90deg, rgba(13, 148, 136, 0.25) 0deg, rgba(13, 148, 136, 0.45) 10deg, rgba(13, 148, 136, 0.6) 20deg, rgba(13, 148, 136, 0.8) ${RADAR_CONFIG.SWEEP_WEDGE_DEG}deg, transparent ${RADAR_CONFIG.SWEEP_WEDGE_DEG}deg, transparent 360deg)`,
                                            transformOrigin: 'center',
                                            zIndex: 4,
                                            pointerEvents: 'none',
                                            willChange: 'transform',
                                            animation: `radarSweepRotate ${RADAR_CONFIG.SCAN_DURATION_SEC}s linear infinite`
                                        }}
                                    />
                                    {/* غرف = blips — أنيميشن ألوان أغمق/أفتح للغرفة تحت المؤشر فقط */}
                                    {radarRoomPositions.map(({ roomNum, x, y, colorIndex }, i) => {
                                        const isScanned = scannedRoomIndex === i;
                                        const hue = [182, 175, 168, 178][colorIndex % 4];
                                        return (
                                            <div
                                                key={roomNum}
                                                style={{
                                                    position: 'absolute',
                                                    left: `${x}%`,
                                                    top: `${y}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    zIndex: 5,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <div
                                                    className={isScanned ? 'radar-blip-animated' : undefined}
                                                    style={{
                                                        width: isScanned ? '18px' : '12px',
                                                        height: isScanned ? '18px' : '12px',
                                                        borderRadius: '50%',
                                                        background: isScanned
                                                            ? `hsl(${hue}, 75%, 55%)`
                                                            : (isDark ? 'rgba(20, 184, 166, 0.5)' : 'rgba(20, 184, 166, 0.5)'),
                                                        boxShadow: isScanned
                                                            ? `0 0 20px hsla(${hue}, 80%, 60%, 0.9), 0 0 40px hsla(${hue}, 80%, 55%, 0.5)`
                                                            : '0 0 10px rgba(32, 178, 170, 0.5)',
                                                        transition: 'width 0.2s ease, height 0.2s ease, background 0.2s ease',
                                                        ['--blip-hue' as string]: hue
                                                    }}
                                                />
                                                {isScanned && (
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            color: `hsl(${hue}, 80%, 60%)`,
                                                            textShadow: `0 0 8px hsla(${hue}, 80%, 60%, 0.9)`,
                                                            animation: 'roomScanCheckIn 0.35s ease-out'
                                                        }}
                                                    >
                                                        {roomNum}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                
                                {/* شارة عمليات تلقائية — أكبر 30% من الحجم السابق، بدون outline */}
                                <div
                                    role="presentation"
                                    tabIndex={-1}
                                    className="mt-2 lg:mt-3 flex items-center justify-center origin-center [outline:none] focus:[outline:none] focus-visible:[outline:none]"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 16px',
                                        borderRadius: '13px',
                                        background: isDark 
                                            ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.2) 0%, rgba(20, 184, 166, 0.12) 100%)'
                                            : 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(20, 184, 166, 0.08) 100%)',
                                        backdropFilter: 'blur(12px) saturate(180%)',
                                        border: `1px solid ${isDark ? 'rgba(20, 184, 166, 0.4)' : 'rgba(20, 184, 166, 0.3)'}`,
                                        boxShadow: isDark
                                            ? `0 3px 12px rgba(20, 184, 166, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset`
                                            : `0 3px 12px rgba(20, 184, 166, 0.12), 0 0 0 1px rgba(13, 148, 136, 0.15) inset`,
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: 'scale(0.624)',
                                        outline: 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(0.624) translateY(-1px)';
                                        e.currentTarget.style.boxShadow = isDark
                                            ? `0 4px 16px rgba(20, 184, 166, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.08) inset`
                                            : `0 4px 16px rgba(20, 184, 166, 0.18), 0 0 0 1px rgba(13, 148, 136, 0.2) inset`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(0.624)';
                                        e.currentTarget.style.boxShadow = isDark
                                            ? `0 3px 12px rgba(20, 184, 166, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.05) inset`
                                            : `0 3px 12px rgba(20, 184, 166, 0.12), 0 0 0 1px rgba(13, 148, 136, 0.15) inset`;
                                    }}
                                >
                                    <div
                                        className="cta-badge-gear"
                                        style={{
                                            width: '27px',
                                            height: '27px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            animation: 'autoGearRotate 3s linear infinite',
                                            filter: isDark ? 'drop-shadow(0 0 8px rgba(20, 184, 166, 0.6))' : 'drop-shadow(0 0 6px rgba(13, 148, 136, 0.5))',
                                            outline: 'none',
                                            boxShadow: 'none',
                                            border: 'none'
                                        }}
                                        tabIndex={-1}
                                    >
                                        <svg
                                            width="27"
                                            height="27"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke={THEME.turquoise}
                                            strokeWidth="2.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            focusable={false}
                                            aria-hidden={true}
                                        >
                                            <circle cx="12" cy="12" r="3"/>
                                            <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"/>
                                        </svg>
                                    </div>
                                    
                                    <span
                                        style={{
                                            fontSize: '16px',
                                            fontWeight: '700',
                                            color: isDark ? 'rgba(255, 255, 255, 0.98)' : 'rgba(30, 41, 59, 0.95)',
                                            letterSpacing: '0.3px',
                                            textShadow: isDark ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none'
                                        }}
                                    >
                                        {t('aboutUs.whyAdora.automaticOperations') || 'عمليات تلقائية'}
                                    </span>
                                    
                                    <div
                                        className="cta-badge-dot"
                                        style={{
                                            width: '7px',
                                            height: '7px',
                                            borderRadius: '50%',
                                            background: `radial-gradient(circle, ${THEME.turquoise} 0%, ${THEME.turquoise}CC 100%)`,
                                            boxShadow: '0 0 6px rgba(32, 178, 170, 0.6), 0 0 12px rgba(32, 178, 170, 0.3)',
                                            animation: 'autoDotPulse 2s ease-in-out infinite'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </Container>
            </Section>

            </div>

            {/* Footer — آخر المحتوى قبل توقيع المطور */}
            <footer 
                className="py-4 px-4 border-t mt-auto"
                style={{
                    background: 'var(--theme-bg-primary)',
                    borderColor: 'var(--theme-border-primary)'
                }}
            >
                <Container>
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2">
                            <Heart className="w-5 h-5" style={{ color: THEME.turquoise }} />
                            <p style={{ color: 'var(--theme-text-secondary)' }}>
                                {t('aboutUs.footer.text')}
                            </p>
                        </div>
                        <p 
                            className="text-xs"
                            style={{ color: 'var(--theme-text-tertiary)' }}
                        >
                            {t('aboutUs.footer.copyright').replace('{year}', String(new Date().getFullYear()))}
                        </p>
                    </div>
                </Container>
            </footer>

            {/* Trial Request Modal */}
            <UnifiedModal
                isOpen={showTrialModal}
                onClose={() => {
                    if (!isSubmitting) {
                        setShowTrialModal(false);
                        setIsSuccess(false);
                        setTrialName('');
                        setTrialPhone('');
                        setTrialRequiredBranches(1);
                    }
                }}
                title={isSuccess ? undefined : t('aboutUs.trialForm.title')}
                subtitle={isSuccess ? undefined : t('aboutUs.trialForm.subtitle')}
                icon={isSuccess ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : <Send className="w-6 h-6 text-teal-400" />}
                size="md"
                showCloseButton={!isSuccess && !isSubmitting}
                closeOnBackdrop={!isSubmitting}
            >
                {isSuccess ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{t('aboutUs.trialForm.successTitle')}</h3>
                        <p className="text-white/80">{t('aboutUs.trialForm.successMessage')}</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Name Input */}
                        <div>
                            <label htmlFor="trial-name" className="block text-sm font-medium text-white/80 mb-2">
                                {t('aboutUs.trialForm.nameLabel')} <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    id="trial-name"
                                    type="text"
                                    value={trialName}
                                    onChange={(e) => setTrialName(e.target.value)}
                                    placeholder={t('aboutUs.trialForm.namePlaceholder')}
                                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    dir="rtl"
                                    disabled={isSubmitting}
                                    autoComplete="name"
                                />
                            </div>
                        </div>

                        {/* Phone Input */}
                        <div>
                            <label htmlFor="trial-phone" className="block text-sm font-medium text-white/80 mb-2">
                                {t('aboutUs.trialForm.phoneLabel')} <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    id="trial-phone"
                                    type="tel"
                                    value={trialPhone}
                                    onChange={(e) => setTrialPhone(e.target.value.replace(/[^\d+]/g, ''))}
                                    placeholder={t('aboutUs.trialForm.phonePlaceholder') || '+1234567890'}
                                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    dir="ltr"
                                    disabled={isSubmitting}
                                    maxLength={20}
                                    autoComplete="tel"
                                />
                            </div>
                            <p className="text-xs text-white/50 mt-1">{t('aboutUs.trialForm.phoneExample')}</p>
                        </div>

                        {/* Required Branches Input - Enhanced with Dropdown */}
                        <div>
                            <label htmlFor="trial-branches" className="block text-sm font-medium text-white/80 mb-2">
                                عدد التراخيص المطلوبة (كل فرع = ترخيص واحد)
                            </label>
                            <div className="space-y-3">
                                {/* Quick Select Buttons */}
                                <div className="grid grid-cols-4 gap-2">
                                    {[1, 2, 3, 4, 5, 10, 15, 20].map((num) => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => setTrialRequiredBranches(num)}
                                            disabled={isSubmitting}
                                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                                trialRequiredBranches === num
                                                    ? 'bg-teal-500 text-white border-2 border-teal-400'
                                                    : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Custom Input */}
                                <div className="relative">
                                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        id="trial-branches"
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={trialRequiredBranches}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10) || 1;
                                            setTrialRequiredBranches(Math.max(1, Math.min(100, val)));
                                        }}
                                        placeholder="أو أدخل عدد مخصص (1-100)"
                                        className="w-full pr-10 pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                        dir="ltr"
                                        disabled={isSubmitting}
                                        aria-describedby="trial-branches-hint"
                                    />
                                </div>
                            </div>
                            <p id="trial-branches-hint" className="text-xs text-white/50 mt-2">
                                عدد الفروع التي تحتاجها (كل فرع يحتاج ترخيص واحد) • المحدد: <span className="text-teal-400 font-semibold">{trialRequiredBranches} ترخيص</span>
                            </p>
                        </div>

                        {/* Submit Button */}
                        <ModalActions
                            onCancel={() => {
                                if (!isSubmitting) {
                                    setShowTrialModal(false);
                                    setTrialName('');
                                    setTrialPhone('');
                                    setTrialRequiredBranches(1);
                                }
                            }}
                            onConfirm={handleTrialSubmit}
                            cancelText={t('aboutUs.trialForm.cancel')}
                            confirmText={t('aboutUs.trialForm.submit')}
                            confirmVariant="primary"
                            loading={isSubmitting}
                            disabled={!trialName.trim() || !trialPhone.trim() || isSubmitting}
                        />
                    </div>
                )}
            </UnifiedModal>
            </div>

            {/* أنماط الصفحة: شعار، رادار، نجوم، أزرار، خلفيات (للصيانة: تعديل الأنيميشن من هنا) */}
            <style>{`
                /* Logo floating animation - Only Logo Moves, Page Stays Fixed */
                .logo-float {
                    animation: logoFloat 4s ease-in-out infinite;
                    will-change: transform;
                }
                @keyframes logoFloat {
                    0%, 100% { 
                        transform: translateY(0) rotate(0deg) translateZ(0); 
                    }
                    25% { 
                        transform: translateY(-6px) rotate(1deg) translateZ(0); 
                    }
                    50% { 
                        transform: translateY(-12px) rotate(0deg) translateZ(0); 
                    }
                    75% { 
                        transform: translateY(-6px) rotate(-1deg) translateZ(0); 
                    }
                }
                
                /* 🪐 Orbital animations - Planets around the logo (Centered) */
                .animate-orbit-1 {
                    animation: orbit 12s linear infinite;
                    transform-origin: center center;
                }
                .animate-orbit-2 {
                    animation: orbit 18s linear infinite reverse;
                    transform-origin: center center;
                }
                .animate-orbit-3 {
                    animation: orbit 25s linear infinite;
                    transform-origin: center center;
                }
                @keyframes orbit {
                    from { transform: translate(-50%, -50%) rotate(0deg); }
                    to { transform: translate(-50%, -50%) rotate(360deg); }
                }
                
                /* ✅ Inspired by juleb.com/ar - Advanced Scroll Animations */
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(40px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                @keyframes fadeInLeft {
                    from {
                        opacity: 0;
                        transform: translateX(-40px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
                
                @keyframes fadeInRight {
                    from {
                        opacity: 0;
                        transform: translateX(40px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }
                
                @keyframes scaleIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8) rotate(-5deg);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) rotate(0deg);
                    }
                }
                
                @keyframes slideInFromBottom {
                    from {
                        opacity: 0;
                        transform: translateY(60px) scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                
                @keyframes bounceIn {
                    0% {
                        opacity: 0;
                        transform: scale(0.3) translateY(50px);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.05) translateY(-5px);
                    }
                    70% {
                        transform: scale(0.95) translateY(0);
                    }
                    100% {
                        transform: scale(1) translateY(0);
                    }
                }
                
                /* Smooth parallax effect */
                .parallax-slow {
                    transition: transform 0.5s ease-out;
                }
                
                /* Glassmorphism hover effect */
                .glass-hover {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .glass-hover:hover {
                    backdrop-filter: blur(20px);
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(32, 178, 170, 0.3);
                }
                
                /* Smooth entrance animation for hero section */
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .hero-content {
                    animation: fadeInUp 0.8s ease-out;
                }
                
                /* Mobile optimizations */
                @media (max-width: 640px) {
                    .animate-orbit-1,
                    .animate-orbit-2,
                    .animate-orbit-3 {
                        animation-duration: 15s, 22s, 30s;
                    }
                }
                
                /* 🎯 Active Requests Radar - Real Radar Screen Animation */
                
                /* ✅ Auto Badge Pulse Animation */
                @keyframes autoBadgePulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                        box-shadow: 0 2px 8px rgba(32, 178, 170, 0.6), 0 0 12px rgba(32, 178, 170, 0.4);
                    }
                    50% {
                        transform: scale(1.05);
                        opacity: 0.95;
                        box-shadow: 0 4px 16px rgba(32, 178, 170, 0.8), 0 0 20px rgba(32, 178, 170, 0.6);
                    }
                }
                
                /* ✅ Auto Gear Rotate Animation */
                @keyframes autoGearRotate {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
                
                /* ✅ Auto Dot Pulse Animation */
                @keyframes autoDotPulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 0 0 12px rgba(32, 178, 170, 0.8), 0 0 24px rgba(32, 178, 170, 0.4);
                    }
                    50% {
                        opacity: 0.7;
                        transform: scale(1.2);
                        box-shadow: 0 0 20px rgba(32, 178, 170, 1), 0 0 40px rgba(32, 178, 170, 0.6);
                    }
                }
                
                /* Triangle indicator - positioned at edge, rotates from center */
                .radar-triangle-indicator {
                    transform-origin: 50% 0% !important;
                    will-change: transform;
                }
                
                /* Responsive radar container - Saudi Map Shape */
                .radar-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .saudi-map-container {
                    clip-path: path("M 200 150 
                       L 250 140 L 300 135 L 350 130 L 400 125 L 450 120 L 500 118 
                       L 550 120 L 600 125 L 650 135 L 700 150 L 750 170 L 780 195 
                       L 800 225 L 810 260 L 815 300 L 815 340 L 810 380 L 800 420 
                       L 785 460 L 765 495 L 740 525 L 710 550 L 675 570 L 635 585 
                       L 590 595 L 540 600 L 490 600 L 440 595 L 390 585 L 345 570 
                       L 305 550 L 270 525 L 240 495 L 215 460 L 195 420 L 185 380 
                       L 180 340 L 180 300 L 185 260 L 195 225 L 215 195 L 240 170 Z");
                }
                
                /* Wave animations for scanning effect */
                @keyframes wavePulse {
                    0%, 100% {
                        opacity: 0.6;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.3;
                        transform: scale(1.05);
                    }
                }
                
                @keyframes waveLinePulse {
                    0%, 100% {
                        opacity: 0.6;
                    }
                    50% {
                        opacity: 0.3;
                    }
                }
                
                @keyframes waveCircleExpand {
                    0% {
                        opacity: 0.5;
                        transform: translate(-50%, -50%) scale(0.95);
                    }
                    50% {
                        opacity: 0.3;
                        transform: translate(-50%, -50%) scale(1.02);
                    }
                    100% {
                        opacity: 0.1;
                        transform: translate(-50%, -50%) scale(1.05);
                    }
                }
                
                @keyframes centerPulse {
                    0%, 100% {
                        transform: translate(-50%, -50%) scale(1);
                        box-shadow: 0 0 12px rgba(32, 178, 170, 0.8), 0 0 24px rgba(32, 178, 170, 0.5);
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.2);
                        box-shadow: 0 0 20px rgba(32, 178, 170, 1), 0 0 40px rgba(32, 178, 170, 0.8);
                    }
                }
                
                /* Pulsing Circles Animation - Expanding from center with fade out */
                @keyframes pulseExpand {
                    0% {
                        transform: translate(-50%, -50%) scale(0.3);
                        opacity: 0.9;
                    }
                    30% {
                        opacity: 0.6;
                    }
                    60% {
                        opacity: 0.3;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(12);
                        opacity: 0;
                    }
                }
                
                @media (max-width: 640px) {
                    .radar-container {
                        width: min(90vw, 90vh) !important;
                        height: min(90vw, 90vh) !important;
                    }
                }
                
                @media (min-width: 641px) and (max-width: 1024px) {
                    .radar-container {
                        width: min(50vw, 50vh) !important;
                        height: min(50vw, 50vh) !important;
                    }
                }
                
                @media (min-width: 1025px) {
                    .radar-container {
                        width: min(40vw, 40vh) !important;
                        height: min(40vw, 40vh) !important;
                    }
                }
                
                /* Modern shimmer animation */
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                
                /* Pulse animation for status dot */
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.7;
                        transform: scale(1.2);
                    }
                }
                
                /* Blip Pulse Animation */
                @keyframes blipPulse {
                    0%, 100% {
                        opacity: 0.6;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    50% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1.3);
                    }
                }
                
                /* ============================================
                   PREMIUM BACKGROUND EFFECTS (Same as LoginScreen)
                   ============================================ */
                
                /* Aurora animated gradient */
                .aurora-gradient {
                    background: 
                        linear-gradient(125deg, 
                            rgba(20, 184, 166, 0.15) 0%, 
                            transparent 40%),
                        linear-gradient(225deg, 
                            rgba(6, 182, 212, 0.12) 0%, 
                            transparent 40%),
                        linear-gradient(315deg, 
                            rgba(16, 185, 129, 0.1) 0%, 
                            transparent 40%);
                    animation: auroraMove 15s ease-in-out infinite;
                }
                @keyframes auroraMove {
                    0%, 100% { opacity: 0.8; transform: scale(1) rotate(0deg); }
                    50% { opacity: 1; transform: scale(1.05) rotate(1deg); }
                }
                
                /* Wave background */
                .wave-bg {
                    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%2314b8a6' fill-opacity='0.05' d='M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,202.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E");
                    background-size: cover;
                    background-position: bottom;
                    animation: waveMove 8s ease-in-out infinite;
                }
                @keyframes waveMove {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(-20px); }
                }
                
                /* Floating orbs */
                .orb {
                    border-radius: 50%;
                    filter: blur(60px);
                    animation: orbFloat 20s ease-in-out infinite;
                }
                .orb-1 {
                    background: radial-gradient(circle, rgba(20, 184, 166, 0.4) 0%, rgba(6, 182, 212, 0.2) 50%, transparent 70%);
                    animation-delay: 0s;
                }
                .orb-2 {
                    background: radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(16, 185, 129, 0.15) 50%, transparent 70%);
                    animation-delay: -7s;
                }
                .orb-3 {
                    background: radial-gradient(circle, rgba(45, 212, 191, 0.3) 0%, rgba(20, 184, 166, 0.1) 50%, transparent 70%);
                    animation-delay: -14s;
                }
                @keyframes orbFloat {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    25% { transform: translate(30px, -20px) scale(1.1); }
                    50% { transform: translate(0, -40px) scale(1); }
                    75% { transform: translate(-30px, -20px) scale(1.1); }
                }
                
                /* Hexagon pattern */
                .hex-pattern {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%2314b8a6' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                }
                
                /* Floating shapes */
                .shape {
                    position: absolute;
                    font-size: 24px;
                    color: rgba(20, 184, 166, 0.15);
                    animation: shapeFloat 15s ease-in-out infinite;
                }
                .shape-1 { top: 15%; left: 10%; animation-delay: 0s; font-size: 32px; }
                .shape-2 { top: 25%; right: 15%; animation-delay: -3s; font-size: 20px; }
                .shape-3 { bottom: 35%; left: 8%; animation-delay: -6s; font-size: 28px; }
                .shape-4 { top: 55%; right: 12%; animation-delay: -9s; font-size: 16px; }
                .shape-5 { bottom: 25%; right: 20%; animation-delay: -12s; font-size: 22px; }
                @keyframes shapeFloat {
                    0%, 100% { 
                        transform: translate(0, 0) rotate(0deg); 
                        opacity: 0.15;
                    }
                    25% { 
                        transform: translate(20px, -30px) rotate(90deg); 
                        opacity: 0.25;
                    }
                    50% { 
                        transform: translate(0, -50px) rotate(180deg); 
                        opacity: 0.1;
                    }
                    75% { 
                        transform: translate(-20px, -30px) rotate(270deg); 
                        opacity: 0.2;
                    }
                }
                
                /* Corner decorations */
                .corner-decoration {
                    background: linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, transparent 50%);
                }
                .corner-tl {
                    border-radius: 0 0 100% 0;
                }
                .corner-br {
                    border-radius: 100% 0 0 0;
                    background: linear-gradient(315deg, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
                }
                
                /* Glow pulse animations */
                .glow-pulse {
                    animation: glowPulse 4s ease-in-out infinite;
                }
                .glow-pulse-delay {
                    animation: glowPulse 4s ease-in-out infinite 2s;
                }
                @keyframes glowPulse {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.15); }
                }
                
                /* Pulse Glow Animation for Hover Effect */
                @keyframes pulseGlow {
                    0%, 100% {
                        opacity: 0.15;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.25;
                        transform: scale(1.05);
                    }
                }
                
                /* Twinkling stars animation - Moved to useEffect injection in document.head */
                
                /* Shooting star animation */
                @keyframes shootingStar {
                    0% {
                        opacity: 0;
                        transform: translate(0, 0) scale(1);
                    }
                    10% {
                        opacity: 1;
                    }
                    70% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-300px, 300px) scale(0);
                    }
                }
                .animate-shooting-star {
                    animation: shootingStar 4s ease-out infinite;
                    animation-delay: 3s;
                    box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.8),
                                -100px -100px 20px 0px rgba(255, 255, 255, 0.1);
                }
                
                @keyframes radarWave {
                    0% {
                        transform: translate(-50%, -50%) scale(0);
                        opacity: 0.8;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1);
                        opacity: 0;
                    }
                }
                
                /* Room Number Glow Animation when scanned - Reduced Size */
                @keyframes roomGlow {
                    0% {
                        opacity: 0.5;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.7;
                        transform: scale(1.05);
                    }
                    100% {
                        opacity: 0.3;
                        transform: scale(1.1);
                    }
                }
                
                /* Room Pulse Ring Animation - Reduced Size */
                @keyframes roomPulse {
                    0% {
                        opacity: 0.6;
                        transform: scale(0.9);
                    }
                    50% {
                        opacity: 0.3;
                        transform: scale(1.1);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1.3);
                    }
                }
                
                /* Room Badge Hover Effect */
                .room-badge {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .room-badge:hover {
                    background: rgba(255, 255, 255, 0.25) !important;
                    border-color: rgba(255, 255, 255, 0.5) !important;
                    transform: translate(-50%, -50%) scale(1.1);
                    box-shadow: 0 4px 20px rgba(255, 255, 255, 0.4) !important;
                }
                
                /* When scanning line passes over room - Premium Animation */
                
                /* Detect when sweep passes over room using CSS */
                .radar-container {
                    will-change: transform;
                }
                
                .radar-circle {
                    will-change: opacity;
                }
                
                .radar-wave {
                    will-change: transform, opacity;
                }
                
                /* Room number scanning detection - Advanced */
                .radar-room-number {
                    will-change: transform, opacity;
                }
                
                /* Sparkle animation for scanned rooms */
                @keyframes roomSparkle {
                    0%, 100% {
                        opacity: 0.6;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.3);
                    }
                }
                
                /* Room Bounce Animation - Smooth transition when scanned */
                @keyframes roomBounce {
                    0% {
                        transform: scale(1) translateY(0);
                    }
                    30% {
                        transform: scale(1.3) translateY(-4px);
                    }
                    60% {
                        transform: scale(1.2) translateY(-2px);
                    }
                    100% {
                        transform: scale(1.25) translateY(-2px);
                    }
                }
                
                /* Path Pulse Animation - For connection lines between rooms */
                @keyframes pathPulse {
                    0%, 100% {
                        opacity: 0.5;
                        transform: translate(-50%, -50%) scaleX(1);
                    }
                    50% {
                        opacity: 0.9;
                        transform: translate(-50%, -50%) scaleX(1.05);
                    }
                }
                
                /* Path Dot Move Animation - Moving dot along path */
                @keyframes pathDotMove {
                    0% {
                        transform: translate(-50%, -50%) translateX(0);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    90% {
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) translateX(100%);
                        opacity: 0;
                    }
                }
                
                /* ============================================
                   🎯 2026 PROFESSIONAL RADAR ANIMATIONS
                   Advanced Frontend Design with 20 Years Experience
                   ============================================ */
                
                /* 2026 Radar Background Pulse */
                @keyframes radarBgPulse {
                    0%, 100% {
                        opacity: 0.6;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.8;
                        transform: scale(1.02);
                    }
                }
                
                /* 2026 Grid Circle Pulse */
                @keyframes gridCirclePulse {
                    0%, 100% {
                        opacity: 0.5;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    50% {
                        opacity: 0.3;
                        transform: translate(-50%, -50%) scale(1.03);
                    }
                }
                
                /* 2026 Radial Grid Pulse */
                @keyframes radialGridPulse {
                    0%, 100% {
                        opacity: 0.6;
                    }
                    50% {
                        opacity: 0.4;
                    }
                }
                
                /* 2026 Center Hub Pulse */
                @keyframes centerHubPulse {
                    0%, 100% {
                        transform: translate(-50%, -50%) scale(1);
                        box-shadow: 
                            0 0 20px rgba(32, 178, 170, 0.8),
                            0 0 40px rgba(32, 178, 170, 0.6),
                            0 0 60px rgba(32, 178, 170, 0.4);
                    }
                    50% {
                        transform: translate(-50%, -50%) scale(1.15);
                        box-shadow: 
                            0 0 30px rgba(32, 178, 170, 1),
                            0 0 60px rgba(32, 178, 170, 0.8),
                            0 0 90px rgba(32, 178, 170, 0.6);
                    }
                }
                
                /* 2026 Advanced Pulse Expand */
                @keyframes advancedPulseExpand {
                    0% {
                        transform: translate(-50%, -50%) scale(0.3);
                        opacity: 0.9;
                    }
                    30% {
                        opacity: 0.7;
                    }
                    60% {
                        opacity: 0.4;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(15);
                        opacity: 0;
                    }
                }
                
                /* 2026 Particle Float */
                @keyframes particleFloat {
                    0%, 100% {
                        transform: translate(-50%, -50%) translate(var(--tx, 0), var(--ty, 0)) scale(1);
                        opacity: 0.6;
                    }
                    50% {
                        transform: translate(-50%, -50%) translate(calc(var(--tx, 0) * 1.2), calc(var(--ty, 0) * 1.2)) scale(1.2);
                        opacity: 0.9;
                    }
                }
                
                /* 2026 Advanced Radar Wave */
                @keyframes advancedRadarWave {
                    0% {
                        transform: translate(-50%, -50%) scale(0);
                        opacity: 0.9;
                    }
                    50% {
                        opacity: 0.5;
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1.1);
                        opacity: 0;
                    }
                }
                
                /* رادار دائري: شعاع wedge دوّار + blips */
                @keyframes radarSweepRotate {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(-360deg); }
                }
                .radar-dome-square { aspect-ratio: 1 / 1; box-sizing: border-box; }
                .radar-sweep-wedge-rotate { animation: radarSweepRotate 8s linear infinite; }
                @keyframes radarBlipPulse {
                    0% { transform: scale(1); filter: brightness(0.8); }
                    40% { transform: scale(1.3); filter: brightness(1.4); }
                    70% { transform: scale(1.15); filter: brightness(0.95); }
                    100% { transform: scale(1); filter: brightness(0.8); }
                }
                .radar-blip-animated { animation: radarBlipPulse 0.55s ease-in-out infinite; }
                /* إزالة المربع/الإطار الأسود حول مؤشر مركز الرادار في الوضع الفاتح */
                [data-theme="light"] .radar-center-dot,
                .radar-center-dot,
                .radar-center-dot:focus,
                .radar-center-dot:focus-visible {
                    outline: none !important;
                    border: none !important;
                    box-shadow: 0 0 12px rgba(13, 148, 136, 0.8), 0 0 24px rgba(13, 148, 136, 0.4) !important;
                }
                /* إزالة أي outline/مربع أسود حول شارة عمليات تلقائية والترس */
                .cta-badge-gear,
                .cta-badge-gear svg,
                .cta-badge-gear:focus,
                .cta-badge-gear:focus-visible { outline: none !important; border: none !important; }
                @media (prefers-reduced-motion: reduce) {
                    .radar-sweep-wedge,
                    .radar-sweep-wedge-rotate,
                    .radar-blip-animated,
                    .cta-badge-gear,
                    .cta-badge-dot { animation: none !important; }
                }
                @keyframes roomScanCheckIn {
                    0% { opacity: 0; transform: scale(0.3); }
                    100% { opacity: 1; transform: scale(1); }
                }
                
                /* 2026 Shimmer Effects */
                @keyframes shimmer2026 {
                    0% {
                        transform: translateX(-100%) skewX(-15deg);
                    }
                    100% {
                        transform: translateX(200%) skewX(-15deg);
                    }
                }
                
                /* 2026 Button Shimmer Animation */
                @keyframes buttonShimmer2026 {
                    0% {
                        transform: translateX(-100%) translateY(0) skewX(-15deg);
                    }
                    100% {
                        transform: translateX(200%) translateY(0) skewX(-15deg);
                    }
                }
                
                @keyframes shimmer2026Secondary {
                    0% {
                        transform: translateX(-100%) skewX(15deg);
                    }
                    100% {
                        transform: translateX(200%) skewX(15deg);
                    }
                }
                
                /* 2026 Room Badge Activate */
                @keyframes roomBadge2026Activate {
                    0% {
                        transform: scale(1) translateY(0) rotate(0deg);
                    }
                    25% {
                        transform: scale(1.25) translateY(-6px) rotate(2deg);
                    }
                    50% {
                        transform: scale(1.2) translateY(-5px) rotate(-1deg);
                    }
                    75% {
                        transform: scale(1.18) translateY(-4px) rotate(0.5deg);
                    }
                    100% {
                        transform: scale(1.15) translateY(-4px) rotate(0deg);
                    }
                }
                
                /* 2026 Status Dot Pulse */
                @keyframes statusDot2026Pulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                        box-shadow: 
                            0 0 12px rgba(255, 255, 255, 1),
                            0 0 24px rgba(255, 255, 255, 0.6),
                            0 0 36px rgba(255, 255, 255, 0.3);
                    }
                    50% {
                        opacity: 0.8;
                        transform: scale(1.3);
                        box-shadow: 
                            0 0 20px rgba(255, 255, 255, 1),
                            0 0 40px rgba(255, 255, 255, 0.8),
                            0 0 60px rgba(255, 255, 255, 0.5);
                    }
                }
                
                /* 2026 Auto Badge Pulse */
                @keyframes autoBadge2026Pulse {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 1;
                        box-shadow: 
                            0 3px 12px rgba(32, 178, 170, 0.7),
                            0 0 20px rgba(32, 178, 170, 0.5),
                            0 0 30px rgba(32, 178, 170, 0.3);
                    }
                    50% {
                        transform: scale(1.08);
                        opacity: 0.95;
                        box-shadow: 
                            0 5px 18px rgba(32, 178, 170, 0.9),
                            0 0 30px rgba(32, 178, 170, 0.7),
                            0 0 45px rgba(32, 178, 170, 0.5);
                    }
                }
                
                /* 2026 Room Glow */
                @keyframes roomGlow2026 {
                    0%, 100% {
                        opacity: 0.6;
                        transform: scale(1);
                        filter: blur(8px) drop-shadow(0 0 8px rgba(32, 178, 170, 0.7));
                    }
                    50% {
                        opacity: 0.9;
                        transform: scale(1.1);
                        filter: blur(10px) drop-shadow(0 0 12px rgba(32, 178, 170, 0.9));
                    }
                }
                
                /* 2026 Room Pulse */
                @keyframes roomPulse2026 {
                    0% {
                        opacity: 0.7;
                        transform: scale(0.95);
                    }
                    50% {
                        opacity: 0.4;
                        transform: scale(1.15);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1.4);
                    }
                }
                
                /* 2026 Sparkle Float */
                @keyframes sparkle2026Float {
                    0%, 100% {
                        transform: translate(-50%, -50%) translate(var(--sx, 0), var(--sy, 0)) scale(1);
                        opacity: 0.8;
                    }
                    25% {
                        transform: translate(-50%, -50%) translate(calc(var(--sx, 0) * 1.3), calc(var(--sy, 0) * 0.9)) scale(1.1);
                        opacity: 1;
                    }
                    50% {
                        transform: translate(-50%, -50%) translate(calc(var(--sx, 0) * 1.1), calc(var(--sy, 0) * 1.2)) scale(1.2);
                        opacity: 0.9;
                    }
                    75% {
                        transform: translate(-50%, -50%) translate(calc(var(--sx, 0) * 0.9), calc(var(--sy, 0) * 1.1)) scale(1.05);
                        opacity: 0.7;
                    }
                }
                
                /* Sparkle effects */
                .animate-sparkle {
                    animation: sparkle 4s ease-in-out infinite;
                }
                .animate-sparkle-delay {
                    animation: sparkle 4s ease-in-out infinite 1s;
                }
                .animate-sparkle-delay-2 {
                    animation: sparkle 4s ease-in-out infinite 2s;
                }
                @keyframes sparkle {
                    0%, 100% { opacity: 0; transform: scale(0); }
                    50% { opacity: 1; transform: scale(1); }
                }
                
                /* Ultra crisp logo rendering - High Quality */
                .logo-crisp {
                    image-rendering: -webkit-optimize-contrast;
                    image-rendering: auto;
                    -webkit-backface-visibility: hidden;
                    backface-visibility: hidden;
                    transform: translateZ(0);
                    -webkit-transform: translateZ(0);
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    will-change: transform;
                }
                
                /* For high DPI screens - Maximum Quality */
                @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
                    .logo-crisp {
                        image-rendering: auto;
                        image-rendering: -webkit-optimize-contrast;
                    }
                }
                
                /* For ultra high DPI screens */
                @media (-webkit-min-device-pixel-ratio: 3), (min-resolution: 288dpi) {
                    .logo-crisp {
                        image-rendering: auto;
                    }
                }
            `}</style>
        </div>
    );
};

export default AboutUs;
