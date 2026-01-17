/**
 * About Us Page
 * Professional About page for Adora Hotel Management System
 * 
 * Features:
 * - Modern design with Adora Turquoise branding
 * - Clean sections highlighting system features
 * - Adora-specific features (Data Doctor, Tenant Isolation, Physics-based Logic)
 * - Responsive mobile-first design
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// ✅ Inspired by juleb.com/ar - Scroll animations
import { useScrollAnimation, useCounterAnimation } from '../hooks/useScrollAnimation';
import {
    Sparkles,
    Shield,
    Zap,
    Database,
    Brain,
    Lock,
    Users,
    BarChart3,
    TrendingUp,
    Award,
    Globe,
    Heart,
    ArrowRight,
    Home,
    CheckCircle2,
    Send,
    Phone,
    User,
    Bed,
    Luggage,
    Wrench,
    Coffee,
    ShoppingCart,
    MessageSquare,
    Bell,
    CreditCard,
    Calendar,
    Clock,
    Star,
    Target,
    PieChart,
    Languages,
    ChevronDown,
    DoorOpen,
    Key
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { UnifiedModal, ModalActions } from '../components/common/UnifiedModal';
import { toast } from '../components/common/EnhancedToast';
import { submitTrialRequest } from '../services/trialRequestService';

// ============================================================
// SECTION COMPONENTS
// ============================================================

interface SectionProps {
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({ children, className = '' }) => (
    <section className={`py-16 sm:py-20 md:py-24 px-4 sm:px-6 lg:px-8 ${className}`}>
        {children}
    </section>
);

const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`max-w-7xl mx-auto ${className}`}>
        {children}
    </div>
);

// ============================================================
// ANIMATED COMPONENTS (Inspired by juleb.com/ar)
// ============================================================

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    delay?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description, delay = 0 }) => {
    const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay });
    const turquoise = '#20B2AA';
    const turquoiseLight = 'rgba(32, 178, 170, 0.1)';
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <div
            ref={ref as React.RefObject<HTMLDivElement>}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`p-4 sm:p-6 rounded-xl transition-all duration-500 ease-out cursor-pointer ${
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
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg mb-3 sm:mb-4 flex items-center justify-center transition-all duration-500 ${
                    isVisible ? 'rotate-0 scale-100 float-animation' : 'rotate-12 scale-0'
                }`}
                style={{ 
                    backgroundColor: isHovered ? 'rgba(32, 178, 170, 0.2)' : turquoiseLight,
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
                    className={`text-lg sm:text-xl font-semibold mb-2 transition-all duration-700 ${
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
                    className={`text-sm sm:text-base transition-all duration-700 ${
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

// ============================================================
// MAIN COMPONENT
// ============================================================

export const AboutUs: React.FC = () => {
    const { isDark } = useTheme();
    const { i18n, t } = useTranslation();
    const navigate = useNavigate();
    
    // ✅ Parallax scroll effect (inspired by juleb.com/ar)
    useEffect(() => {
        const handleScroll = () => {
            const scrolled = window.pageYOffset;
            const parallaxElements = document.querySelectorAll('.parallax-slow');
            parallaxElements.forEach((el) => {
                const speed = 0.5;
                (el as HTMLElement).style.transform = `translateY(${scrolled * speed}px)`;
            });
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    // ✅ Redirect to production domain if accessed locally
    useEffect(() => {
        // Only redirect if not already on production domain
        if (window.location.hostname !== 'adora-hotels.com' && 
            window.location.hostname !== 'www.adora-hotels.com' &&
            !window.location.hostname.includes('localhost') &&
            !window.location.hostname.includes('127.0.0.1')) {
            // For production, redirect to https://adora-hotels.com/about
            window.location.href = 'https://adora-hotels.com/about';
        }
    }, []);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const [trialName, setTrialName] = useState('');
    const [trialPhone, setTrialPhone] = useState('');
    const [trialRequiredBranches, setTrialRequiredBranches] = useState<number>(1);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showLangMenu, setShowLangMenu] = useState(false);
    const [scannedRooms, setScannedRooms] = useState<Set<number>>(new Set());
    const [scannedRoomsOrder, setScannedRoomsOrder] = useState<number[]>([]);
    const [previousScannedRoom, setPreviousScannedRoom] = useState<number | null>(null);
    const radarAnimationRef = useRef<number>(0);

    const turquoise = '#20B2AA';
    const turquoiseLight = 'rgba(32, 178, 170, 0.1)';
    const turquoiseDark = 'rgba(32, 178, 170, 0.2)';
    
    const currentLang = i18n.language || 'ar';
    
    const handleLanguageChange = async (lang: 'ar' | 'en') => {
        await changeLanguage(lang);
        setShowLangMenu(false);
    };

    // Room numbers - Reduced count, all inside circle
    const roomNumbers = [102, 103, 104, 105, 106, 107, 108];
    
    // Color palette for room borders - Turquoise Theme Variations
    const roomBorderColors = [
        '#20B2AA', // Turquoise (Primary)
        '#14B8A6', // Teal
        '#0D9488', // Teal Dark
        '#2DD4BF', // Cyan
        '#06B6D4', // Sky Cyan
        '#0891B2', // Sky Blue
        '#0EA5E9', // Blue
        '#0284C7', // Blue Dark
        '#20B2AA', // Turquoise (repeat)
        '#14B8A6', // Teal (repeat)
        '#0D9488', // Teal Dark (repeat)
        '#2DD4BF', // Cyan (repeat)
        '#06B6D4', // Sky Cyan (repeat)
        '#0891B2'  // Sky Blue (repeat)
    ];
    
    // Calculate room positions - useMemo to prevent recalculation
    // All rooms inside Saudi Arabia map shape, evenly distributed, no overlap
    const roomPositions = React.useMemo(() => {
        const totalRooms = roomNumbers.length;
        // Use fixed distance inside map shape (max 30% from center to stay inside)
        const baseDistance = 25; // Fixed distance for all rooms to prevent overlap
        
        return roomNumbers.map((roomNum, i) => {
            // Distribute rooms evenly around the map (360 degrees divided equally)
            const angle = (i * 360 / totalRooms) * (Math.PI / 180);
            // All rooms at same distance to prevent overlap
            const distance = baseDistance;
            const x = 50 + Math.cos(angle) * distance;
            const y = 50 + Math.sin(angle) * distance;
            // Assign color based on room number (consistent per room)
            const colorIndex = roomNum % roomBorderColors.length;
            const borderColor = roomBorderColors[colorIndex];
            return { roomNum, angle: angle * (180 / Math.PI), x, y, borderColor };
        });
    }, []);

    // Detect when scanning line passes over rooms with smooth transitions
    useEffect(() => {
        const interval = setInterval(() => {
            // Calculate current sweep angle (0-360 degrees)
            // Animation is 8s per rotation (slower)
            const sweepSpeed = 360 / 8; // degrees per second
            const currentTime = Date.now() / 1000;
            const currentAngle = (currentTime * sweepSpeed) % 360;
            
            const newlyScanned = new Set<number>();
            const newOrder: number[] = [];
            let currentScannedRoom: number | null = null;
            
            // Find which room is currently being scanned
            roomPositions.forEach(({ roomNum, angle }) => {
                // Normalize angles to 0-360
                const normalizedRoomAngle = ((angle % 360) + 360) % 360;
                const normalizedSweepAngle = ((currentAngle % 360) + 360) % 360;
                
                // Check if sweep is within 20 degrees of room (wider detection zone)
                const angleDiff = Math.abs(normalizedSweepAngle - normalizedRoomAngle);
                const minDiff = Math.min(angleDiff, 360 - angleDiff);
                
                if (minDiff < 20) {
                    newlyScanned.add(roomNum);
                    newOrder.push(roomNum);
                    if (!currentScannedRoom || minDiff < 5) {
                        currentScannedRoom = roomNum;
                    }
                }
            });
            
            // Track room transitions for path animation
            if (currentScannedRoom && currentScannedRoom !== previousScannedRoom) {
                setPreviousScannedRoom(currentScannedRoom);
            }
            
            setScannedRooms(newlyScanned);
            setScannedRoomsOrder(newOrder);
        }, 30); // Check every 30ms for smooth detection
        
        return () => clearInterval(interval);
    }, [roomPositions, previousScannedRoom]);

    // Handle trial request submission
    const handleTrialSubmit = async () => {
        if (!trialName.trim() || !trialPhone.trim()) {
            toast.error(t('aboutUs.trialForm.namePhoneRequired'));
            return;
        }

        // Basic phone validation (numbers only, at least 8 digits)
        const phoneRegex = /^[0-9]{8,15}$/;
        const cleanPhone = trialPhone.replace(/\s+/g, '');
        if (!phoneRegex.test(cleanPhone)) {
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
            className={`fixed inset-0 ${isDark ? 'bg-slate-950' : 'bg-teal-50'}`}
            style={{ transition: 'background-color 1.5s ease-in-out' }}
        >
            {/* Premium Animated Background - Removed for unified experience */}
            
            {/* 🌙 DARK MODE - Night Sky with Stars */}
            <div className={`absolute inset-0 transition-all duration-[1500ms] ease-in-out ${isDark ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
                <div className={`absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-orange-900/20 via-purple-900/10 to-transparent transition-opacity duration-[2000ms] ${isDark ? 'opacity-100' : 'opacity-0'}`} />
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                    <div className="absolute top-20 right-1/4 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/10 via-indigo-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                </div>
                <div className="absolute inset-0 stars-container">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute rounded-full bg-white animate-twinkle"
                            style={{
                                width: `${Math.random() * 3 + 1}px`,
                                height: `${Math.random() * 3 + 1}px`,
                                top: `${Math.random() * 70}%`,
                                left: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                animationDuration: `${Math.random() * 2 + 2}s`,
                                opacity: Math.random() * 0.7 + 0.3
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
            
            {/* Glowing accents */}
            <div className={`absolute top-10 right-10 w-48 h-48 rounded-full blur-3xl glow-pulse transition-all duration-[1500ms] ${
                isDark 
                    ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10' 
                    : 'bg-gradient-to-br from-teal-400/30 to-cyan-400/20'
            }`} />
            <div className={`absolute bottom-20 left-10 w-56 h-56 rounded-full blur-3xl glow-pulse-delay transition-all duration-[1500ms] ${
                isDark 
                    ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10' 
                    : 'bg-gradient-to-br from-emerald-400/25 to-teal-400/15'
            }`} />
            <div className={`absolute top-1/2 left-1/4 w-32 h-32 rounded-full blur-2xl animate-pulse transition-all duration-[1500ms] ${
                isDark 
                    ? 'bg-gradient-to-br from-cyan-500/15 to-blue-500/10' 
                    : 'bg-gradient-to-br from-amber-400/20 to-orange-400/10'
            }`} />
            
            <div 
                className="min-h-screen relative z-10"
                style={{
                    color: 'var(--theme-text-primary)',
                    position: 'relative',
                    overflowX: 'hidden'
                }}
            >
            {/* ✅ Language Switcher Only - Floating Top Right */}
            <div className="fixed top-4 right-4 z-50">
                <div className="relative">
                    <button
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl
                            transition-all duration-200
                            font-medium text-sm
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
                        <Languages className="w-5 h-5" style={{ color: turquoise }} />
                        <span className="font-semibold">
                            {currentLang === 'ar' ? 'عربي' : 'English'}
                        </span>
                        <ChevronDown 
                            className={`w-4 h-4 transition-transform duration-200 ${showLangMenu ? 'rotate-180' : ''}`}
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
                                    absolute top-full mt-2 right-0 rounded-xl shadow-2xl border z-50 min-w-[140px]
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
                                        w-full px-4 py-3 text-right flex items-center justify-between gap-3 
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
                                        <CheckCircle2 className="w-4 h-4" style={{ color: turquoise }} />
                                    )}
                                </button>
                                <div className={`h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                                <button
                                    onClick={() => handleLanguageChange('en')}
                                    className={`
                                        w-full px-4 py-3 text-right flex items-center justify-between gap-3 
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
                                        <CheckCircle2 className="w-4 h-4" style={{ color: turquoise }} />
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Hero Section - Unified Background */}
            <Section 
                style={{
                    background: 'transparent',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <Container>
                    <div className="text-center space-y-4 sm:space-y-6 hero-content" style={{ position: 'relative', zIndex: 1 }}>
                        {/* Logo Container - Mobile Responsive, Centered */}
                        <div 
                            className="flex justify-center items-center mb-4 sm:mb-6 relative mx-auto"
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
                                {t('aboutUs.hero.title').replace('{adora}', '').trim()}
                                <span key="adora" style={{ color: turquoise, fontWeight: '700', letterSpacing: '1px' }}>ADORA</span>
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
                                <>يوفر <span style={{ color: turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight1')}</span> ويزيد من <span style={{ color: turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight2')}</span></>
                            ) : (
                                <>Saves <span style={{ color: turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight1')}</span> and increases <span style={{ color: turquoise, fontWeight: '600' }}>{t('aboutUs.hero.subtitleHighlight2')}</span></>
                            )}
                            </p>
                        </AnimatedSection>
                        <AnimatedSection delay={300}>
                            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-6 sm:mt-8 px-4">
                                <button
                                    onClick={() => setShowTrialModal(true)}
                                    className="px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 flex items-center gap-2 hover:scale-110 hover:shadow-2xl active:scale-95 shadow-lg"
                                    style={{ 
                                        backgroundColor: turquoise,
                                        transform: 'translateY(0)',
                                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
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

            {/* Features Section - Unified Background */}
            <Section 
                style={{
                    background: 'transparent'
                }}
            >
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center mb-8 sm:mb-12 px-4">
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4"
                                style={{ 
                                    color: 'var(--theme-text-primary)',
                                    textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                }}
                            >
                                {t('aboutUs.features.title', { adora: <span key="adora" style={{ color: turquoise }}>أدورا</span> })}
                            </h2>
                            <p 
                                className="text-base sm:text-lg"
                                style={{ color: 'var(--theme-text-secondary)' }}
                            >
                                {t('aboutUs.features.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-4">
                        {/* Feature 1: إدارة الاستقبال */}
                        <FeatureCard
                            icon={<Users className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.reception.title')}
                            description={t('aboutUs.features.reception.desc')}
                            delay={0}
                        />

                        {/* Feature 2-12: Using FeatureCard component with staggered animations */}
                        <FeatureCard
                            icon={<Bed className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.housekeeping.title')}
                            description={t('aboutUs.features.housekeeping.desc')}
                            delay={50}
                        />
                        <FeatureCard
                            icon={<Luggage className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.bellman.title')}
                            description={t('aboutUs.features.bellman.desc')}
                            delay={100}
                        />
                        <FeatureCard
                            icon={<Wrench className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.maintenance.title')}
                            description={t('aboutUs.features.maintenance.desc')}
                            delay={150}
                        />
                        <FeatureCard
                            icon={<ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.procurement.title')}
                            description={t('aboutUs.features.procurement.desc')}
                            delay={200}
                        />
                        <FeatureCard
                            icon={<Coffee className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.coffee.title')}
                            description={t('aboutUs.features.coffee.desc')}
                            delay={250}
                        />
                        <FeatureCard
                            icon={<MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.chat.title')}
                            description={t('aboutUs.features.chat.desc')}
                            delay={300}
                        />
                        <FeatureCard
                            icon={<Target className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.points.title')}
                            description={t('aboutUs.features.points.desc')}
                            delay={350}
                        />
                        <FeatureCard
                            icon={<Star className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.loyalty.title')}
                            description={t('aboutUs.features.loyalty.desc')}
                            delay={400}
                        />
                        <FeatureCard
                            icon={<BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.reports.title')}
                            description={t('aboutUs.features.reports.desc')}
                            delay={450}
                        />
                        <FeatureCard
                            icon={<Globe className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.multiBranch.title')}
                            description={t('aboutUs.features.multiBranch.desc')}
                            delay={500}
                        />
                        <FeatureCard
                            icon={<Bell className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: turquoise }} />}
                            title={t('aboutUs.features.alerts.title')}
                            description={t('aboutUs.features.alerts.desc')}
                            delay={550}
                        />
                    </div>
                </Container>
            </Section>

            {/* Security Section - Unified Background */}
            <Section 
                style={{
                    background: 'transparent'
                }}
            >
                <Container>
                    <div className="max-w-4xl mx-auto">
                        <AnimatedSection delay={0}>
                            <div className="text-center mb-12">
                                <div 
                                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center transition-all duration-500 hover:scale-110 hover:rotate-12"
                                    style={{ 
                                        backgroundColor: turquoiseLight,
                                        boxShadow: '0 4px 20px rgba(32, 178, 170, 0.2)',
                                        animation: 'bounceIn 0.8s ease-out'
                                    }}
                                >
                                    <Lock className="w-8 h-8" style={{ color: turquoise }} />
                                </div>
                                <h2 
                                    className="text-3xl sm:text-4xl font-bold mb-4"
                                    style={{ 
                                        color: 'var(--theme-text-primary)',
                                        textShadow: '0 2px 10px rgba(32, 178, 170, 0.1)'
                                    }}
                                >
                                    {t('aboutUs.security.title')}
                                </h2>
                                <p 
                                    className="text-lg"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                >
                                    {t('aboutUs.security.subtitle')}
                                </p>
                            </div>
                        </AnimatedSection>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { titleKey: 'aboutUs.security.tenantIsolation.title', descKey: 'aboutUs.security.tenantIsolation.desc' },
                                { titleKey: 'aboutUs.security.rbac.title', descKey: 'aboutUs.security.rbac.desc' },
                                { titleKey: 'aboutUs.security.encryptedTokens.title', descKey: 'aboutUs.security.encryptedTokens.desc' },
                                { titleKey: 'aboutUs.security.atomicOps.title', descKey: 'aboutUs.security.atomicOps.desc' },
                                { titleKey: 'aboutUs.security.auditLogs.title', descKey: 'aboutUs.security.auditLogs.desc' },
                                { titleKey: 'aboutUs.security.monitoring.title', descKey: 'aboutUs.security.monitoring.desc' }
                            ].map((item, index) => {
                                const { ref, isVisible } = useScrollAnimation({ threshold: 0.1, delay: index * 100 });
                                return (
                                    <div
                                        key={index}
                                        ref={ref as React.RefObject<HTMLDivElement>}
                                        className={`p-4 rounded-lg flex items-start gap-3 transition-all duration-700 ${
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
                                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 transition-transform duration-300 hover:scale-110" style={{ color: turquoise }} />
                                        <div>
                                            <h3 
                                                className="font-semibold mb-1"
                                                style={{ color: 'var(--theme-text-primary)' }}
                                            >
                                                {t(item.titleKey)}
                                            </h3>
                                            <p style={{ color: 'var(--theme-text-secondary)' }}>
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

            {/* CTA Section - Elegant Light Background */}
            <Section 
                style={{
                    background: isDark 
                        ? 'rgba(15, 23, 42, 0.95)'
                        : '#fefefe',
                    position: 'relative',
                    overflow: 'hidden',
                    minHeight: 'clamp(500px, 60vh, 700px)',
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    paddingTop: 'clamp(32px, 8vw, 64px)',
                    paddingBottom: 'clamp(32px, 8vw, 64px)'
                }}
            >
                <Container>
                    <AnimatedSection delay={0}>
                        <div className="text-center max-w-3xl mx-auto relative z-10 py-8 sm:py-12">
                            <h2 
                                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 md:mb-6"
                                style={{ 
                                    color: isDark ? '#ffffff' : 'var(--theme-text-primary)',
                                    textShadow: isDark ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none'
                                }}
                            >
                                {t('aboutUs.cta.title')}
                            </h2>
                            <p 
                                className="text-base sm:text-lg md:text-xl font-medium mb-6 sm:mb-8 md:mb-10 px-4"
                                style={{ 
                                    color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'var(--theme-text-secondary)',
                                    textShadow: isDark ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none'
                                }}
                            >
                                {t('aboutUs.cta.subtitle')}
                            </p>
                        </div>
                    </AnimatedSection>
                        
                        {/* 🗺️ Saudi Arabia Map Radar - Premium Professional Design */}
                        <div 
                            className="relative w-full flex items-center justify-center mb-8 sm:mb-10 md:mb-12"
                            style={{
                                minHeight: 'clamp(350px, min(55vw, 55vh), 600px)',
                                maxHeight: 'clamp(350px, min(55vw, 55vh), 600px)',
                                marginTop: 'clamp(20px, 5vw, 40px)',
                                marginBottom: 'clamp(30px, 7vw, 60px)',
                                padding: 'clamp(15px, 3vw, 30px)'
                            }}
                        >
                            <div 
                                className="saudi-map-radar-premium"
                                style={{
                                    position: 'relative',
                                    width: 'clamp(350px, min(55vw, 55vh), 600px)',
                                    height: 'clamp(350px, min(55vw, 55vh), 600px)',
                                    maxWidth: 'min(98vw, 98vh)',
                                    maxHeight: 'min(98vw, 98vh)',
                                    aspectRatio: '1 / 1',
                                    margin: '0 auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'visible'
                                }}
                            >
                                
                                {/* Premium Wave Circles - 8 Concentric Circles from Center */}
                                {[1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3].map((scale, i) => (
                                    <div
                                        key={`premium-wave-${i}`}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            width: `${scale * 100}%`,
                                            height: `${scale * 100}%`,
                                            transform: 'translate(-50%, -50%)',
                                            borderRadius: '50%',
                                            border: `2.5px dashed ${isDark ? `rgba(32, 178, 170, ${0.3 - i * 0.035})` : `rgba(32, 178, 170, ${0.25 - i * 0.03})`}`,
                                            zIndex: 2,
                                            opacity: 0.7 - (i * 0.08),
                                            animation: `waveCircleExpand ${5 + i * 0.6}s ease-out infinite`,
                                            animationDelay: `${i * 0.5}s`,
                                            boxShadow: `0 0 ${25 + i * 10}px ${isDark ? `rgba(32, 178, 170, ${0.15 - i * 0.018})` : `rgba(32, 178, 170, ${0.12 - i * 0.015})`}`,
                                            filter: 'blur(0.5px)'
                                        }}
                                    />
                                ))}
                                
                                {/* Premium Wave Lines - 20 Radial Lines from Center */}
                                {Array.from({ length: 20 }).map((_, i) => {
                                    const angle = (i * 18) * (Math.PI / 180);
                                    return (
                                        <div
                                            key={`premium-wave-line-${i}`}
                                            style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                width: '1.5px',
                                                height: '45%',
                                                background: isDark
                                                    ? 'linear-gradient(to bottom, rgba(32, 178, 170, 0.35) 0%, rgba(32, 178, 170, 0.15) 40%, rgba(32, 178, 170, 0.05) 70%, transparent 100%)'
                                                    : 'linear-gradient(to bottom, rgba(32, 178, 170, 0.3) 0%, rgba(32, 178, 170, 0.12) 40%, rgba(32, 178, 170, 0.04) 70%, transparent 100%)',
                                                transformOrigin: 'bottom center',
                                                transform: `translate(-50%, -100%) rotate(${angle * (180 / Math.PI)}deg)`,
                                                zIndex: 2,
                                                opacity: 0.75,
                                                animation: `waveLinePulse ${3 + (i % 5) * 0.4}s ease-in-out infinite`,
                                                animationDelay: `${i * 0.18}s`,
                                                boxShadow: `0 0 8px ${isDark ? 'rgba(32, 178, 170, 0.2)' : 'rgba(32, 178, 170, 0.15)'}`
                                            }}
                                        />
                                    );
                                })}
                                
                                {/* Premium Center Point - Riyadh */}
                                <div 
                                    style={{
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        background: 'radial-gradient(circle, rgba(32, 178, 170, 1) 0%, rgba(32, 178, 170, 0.8) 60%, rgba(32, 178, 170, 0.4) 100%)',
                                        boxShadow: '0 0 25px rgba(32, 178, 170, 1), 0 0 50px rgba(32, 178, 170, 0.9), 0 0 80px rgba(32, 178, 170, 0.6)',
                                        zIndex: 6,
                                        border: '3px solid rgba(255, 255, 255, 0.98)',
                                        animation: 'centerPulse 2s ease-in-out infinite'
                                    }}
                                />
                                
                                {/* Pulsing Circles - Expanding from Center with Fade Out */}
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={`pulse-circle-${i}`}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%) scale(0.5)',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '50%',
                                            border: `2px solid ${isDark ? 'rgba(32, 178, 170, 0.8)' : 'rgba(32, 178, 170, 0.7)'}`,
                                            zIndex: 5,
                                            animation: `pulseExpand ${2 + i * 0.3}s ease-out infinite`,
                                            animationDelay: `${i * 0.4}s`,
                                            opacity: 0.8,
                                            pointerEvents: 'none'
                                        }}
                                    />
                                ))}
                                
                                {/* Room Numbers (102-110) - Representing Active Rooms */}
                        {roomPositions.map(({ roomNum, angle, x, y, borderColor }, index) => {
                            const isScanned = scannedRooms.has(roomNum);
                            const distance = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(y - 50, 2));
                            const scanIndex = scannedRoomsOrder.indexOf(roomNum);
                            const isRecentlyScanned = scanIndex >= 0 && scanIndex < 3; // Last 3 scanned rooms
                            
                            // Find next room for path connection
                            const nextRoomIndex = (index + 1) % roomPositions.length;
                            const nextRoom = roomPositions[nextRoomIndex];
                            const nextRoomScanned = scannedRooms.has(nextRoom.roomNum);
                            // Show path if current room is scanned AND next room is also scanned (for smooth transition)
                            const shouldShowPath = isScanned && nextRoomScanned;
                            
                            return (
                                <div
                                    key={roomNum}
                                    className="radar-room-number"
                                    data-room={roomNum}
                                    style={{
                                        position: 'absolute',
                                        left: `${x}%`,
                                        top: `${y}%`,
                                        transform: 'translate(-50%, -50%)',
                                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                >
                                    {/* Path line to next room - Animated - Shows when both rooms are scanned */}
                                    {shouldShowPath && (() => {
                                        const pathAngle = Math.atan2(nextRoom.y - y, nextRoom.x - x) * (180 / Math.PI);
                                        const pathLength = Math.sqrt(Math.pow(nextRoom.x - x, 2) + Math.pow(nextRoom.y - y, 2)) * 2;
                                        
                                        return (
                                            <>
                                                <div
                                                    className="room-path-line"
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '50%',
                                                        width: `${pathLength}%`,
                                                        height: '4px',
                                                        background: `linear-gradient(to right, 
                                                            rgba(32, 178, 170, 0.5) 0%,
                                                            rgba(32, 178, 170, 0.9) 30%,
                                                            rgba(32, 178, 170, 1) 50%,
                                                            rgba(32, 178, 170, 0.9) 70%,
                                                            rgba(32, 178, 170, 0.5) 100%
                                                        )`,
                                                        transformOrigin: 'left center',
                                                        transform: `translate(-50%, -50%) rotate(${pathAngle}deg)`,
                                                        opacity: 1,
                                                        animation: 'pathPulse 1.5s ease-in-out infinite',
                                                        boxShadow: '0 0 15px rgba(32, 178, 170, 0.8), 0 0 30px rgba(32, 178, 170, 0.5)',
                                                        zIndex: 0,
                                                        transition: 'opacity 0.3s ease',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                                
                                                {/* Moving dot along path - Like someone running between rooms */}
                                                <div
                                                    className="path-dot"
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '50%',
                                                        width: '14px',
                                                        height: '14px',
                                                        borderRadius: '50%',
                                                        background: 'radial-gradient(circle, rgba(32, 178, 170, 1) 0%, rgba(32, 178, 170, 0.9) 30%, rgba(32, 178, 170, 0.6) 60%, transparent 100%)',
                                                        transformOrigin: 'left center',
                                                        transform: `translate(-50%, -50%) rotate(${pathAngle}deg)`,
                                                        animation: `pathDotMove 1.8s ease-in-out infinite`,
                                                        boxShadow: '0 0 25px rgba(32, 178, 170, 1), 0 0 50px rgba(32, 178, 170, 0.8)',
                                                        zIndex: 2,
                                                        transition: 'all 0.3s ease',
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                                
                                                {/* Trail effect behind moving dot */}
                                                <div
                                                    className="path-trail"
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '50%',
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        background: 'radial-gradient(circle, rgba(32, 178, 170, 0.8) 0%, rgba(32, 178, 170, 0.4) 50%, transparent 100%)',
                                                        transformOrigin: 'left center',
                                                        transform: `translate(-50%, -50%) rotate(${pathAngle}deg)`,
                                                        animation: `pathDotMove 1.8s ease-in-out infinite 0.2s`,
                                                        opacity: 0.7,
                                                        zIndex: 1,
                                                        pointerEvents: 'none'
                                                    }}
                                                />
                                            </>
                                        );
                                    })()}
                                    {/* Modern Hotel Room Badge - Premium 3D Design */}
                                    <div
                                        className="room-badge"
                                        style={{
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '4px',
                                            minWidth: 'clamp(48px, 7vw, 68px)',
                                            height: 'clamp(26px, 4vw, 34px)',
                                            padding: '0 clamp(8px, 1.2vw, 12px)',
                                            background: isScanned 
                                                ? `linear-gradient(135deg, ${borderColor} 0%, ${borderColor}DD 100%)`
                                                : (isDark
                                                    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)'
                                                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)'),
                                            backdropFilter: 'blur(20px) saturate(180%)',
                                            border: isScanned 
                                                ? `1.5px solid ${borderColor}` 
                                                : `1px solid ${borderColor}40`,
                                            borderRadius: '12px',
                                            color: isScanned 
                                                ? '#ffffff'
                                                : (isDark
                                                    ? 'rgba(255, 255, 255, 0.9)'
                                                    : 'rgba(30, 41, 59, 0.9)'),
                                            fontSize: 'clamp(10px, 1.5vw, 13px)',
                                            fontWeight: '700',
                                            fontFamily: 'system-ui, -apple-system, "SF Pro Display", sans-serif',
                                            letterSpacing: '0.2px',
                                            textShadow: isScanned ? '0 1px 4px rgba(0, 0, 0, 0.2)' : 'none',
                                            boxShadow: isScanned
                                                ? `0 8px 32px ${borderColor}66, 0 4px 16px ${borderColor}33, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                                                : (isDark
                                                    ? `0 4px 16px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
                                                    : `0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)`),
                                            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                            transform: isScanned ? 'scale(1.1) translateY(-3px)' : 'scale(1)',
                                            zIndex: isScanned ? 10 : 1,
                                            animation: isScanned ? 'roomBounce 0.6s ease-out' : 'none',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {/* Shimmer effect overlay */}
                                        {isScanned && (
                                            <div 
                                                style={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%)',
                                                    animation: 'shimmer 2s ease-in-out infinite',
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                        )}
                                        
                                        {/* Modern Room Icon */}
                                        <DoorOpen 
                                            style={{
                                                width: 'clamp(16px, 2.4vw, 22px)',
                                                height: 'clamp(16px, 2.4vw, 22px)',
                                                opacity: isScanned ? 1 : 0.8,
                                                color: isScanned ? '#ffffff' : borderColor,
                                                transition: 'all 0.3s ease',
                                                filter: isScanned ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.6))' : 'none',
                                                transform: isScanned ? 'scale(1.1)' : 'scale(1)'
                                            }}
                                        />
                                        
                                        {/* Room Number - Modern Typography */}
                                        <span style={{
                                            fontSize: 'clamp(11px, 1.6vw, 14px)',
                                            fontWeight: '800',
                                            lineHeight: '1',
                                            letterSpacing: '0.4px',
                                            position: 'relative',
                                            zIndex: 1
                                        }}>
                                            {roomNum}
                                        </span>
                                        
                                        {/* Status Indicator Dot */}
                                        <div 
                                            style={{
                                                width: '5px',
                                                height: '5px',
                                                borderRadius: '50%',
                                                background: isScanned ? '#ffffff' : borderColor,
                                                opacity: isScanned ? 1 : 0.6,
                                                transition: 'all 0.3s ease',
                                                boxShadow: isScanned 
                                                    ? '0 0 8px rgba(255, 255, 255, 0.8), 0 0 16px rgba(255, 255, 255, 0.4)' 
                                                    : `0 0 4px ${borderColor}80`,
                                                animation: isScanned ? 'pulse 1.5s ease-in-out infinite' : 'none'
                                            }}
                                        />
                                        
                                        {/* Glow effect when scanned - Reduced Size */}
                                        <div 
                                            className="room-glow"
                                            style={{
                                                position: 'absolute',
                                                inset: '-4px',
                                                borderRadius: '24px',
                                                background: `radial-gradient(circle, ${borderColor}60 0%, ${borderColor}20 50%, transparent 100%)`,
                                                opacity: isScanned ? 0.7 : 0,
                                                transition: 'opacity 0.2s ease',
                                                pointerEvents: 'none',
                                                zIndex: -1,
                                                animation: isScanned ? 'roomGlow 1s ease-out infinite' : 'none',
                                                filter: isScanned ? `drop-shadow(0 0 4px ${borderColor}60)` : 'none'
                                            }}
                                        />
                                        
                                        {/* Pulse ring when scanned - Reduced Size */}
                                        <div 
                                            className="room-pulse-ring"
                                            style={{
                                                position: 'absolute',
                                                inset: '-6px',
                                                borderRadius: '26px',
                                                border: `2px solid ${borderColor}CC`,
                                                opacity: isScanned ? 0.6 : 0,
                                                transform: isScanned ? 'scale(1)' : 'scale(0.8)',
                                                transition: 'all 0.3s ease',
                                                pointerEvents: 'none',
                                                zIndex: -2,
                                                animation: isScanned ? 'roomPulse 1.2s ease-out infinite' : 'none',
                                                boxShadow: isScanned 
                                                    ? `0 0 15px ${borderColor}66, 0 0 30px ${borderColor}33`
                                                    : 'none'
                                            }}
                                        />
                                        
                                        {/* Additional sparkle effect when scanned */}
                                        {isScanned && (
                                            <>
                                                <div 
                                                    style={{
                                                        position: 'absolute',
                                                        top: '-8px',
                                                        right: '-8px',
                                                        width: '12px',
                                                        height: '12px',
                                                        borderRadius: '50%',
                                                        background: 'radial-gradient(circle, rgba(32, 178, 170, 1) 0%, transparent 70%)',
                                                        animation: 'roomSparkle 1s ease-in-out infinite',
                                                        boxShadow: '0 0 15px rgba(32, 178, 170, 0.9)'
                                                    }}
                                                />
                                                <div 
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '-8px',
                                                        left: '-8px',
                                                        width: '10px',
                                                        height: '10px',
                                                        borderRadius: '50%',
                                                        background: 'radial-gradient(circle, rgba(32, 178, 170, 0.9) 0%, transparent 70%)',
                                                        animation: 'roomSparkle 1s ease-in-out infinite 0.3s',
                                                        boxShadow: '0 0 12px rgba(32, 178, 170, 0.7)'
                                                    }}
                                                />
                                            </>
                                        )}
                                    </div>
                                    
                                    {/* Connection line to center (subtle) */}
                                    <div
                                        className="room-connection-line"
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            width: `${distance * 2}%`,
                                            height: '1px',
                                            background: `linear-gradient(to right, 
                                                transparent 0%,
                                                ${isScanned ? 'rgba(32, 178, 170, 0.4)' : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.12)'} 50%,
                                                transparent 100%
                                            )`,
                                            transformOrigin: 'left center',
                                            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                                            opacity: isScanned ? 0.7 : 0.3,
                                            transition: 'opacity 0.2s ease',
                                            boxShadow: isScanned ? '0 0 10px rgba(32, 178, 170, 0.5)' : 'none'
                                        }}
                                    />
                                </div>
                            );
                        })}
                        
                                {/* Radar Waves (Expanding from center) */}
                                {[0, 1, 2].map((i) => (
                                    <div
                                        key={`wave-${i}`}
                                        className="radar-wave"
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.25)'}`,
                                            animation: `radarWave 3s ease-out infinite ${i * 1}s`,
                                            opacity: 0
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center gap-4 mt-6 sm:mt-8">
                            <button
                                onClick={() => {
                                    setScrollPosition(window.scrollY);
                                    setShowTrialModal(true);
                                }}
                                className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center gap-3 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                                style={{
                                    background: '#ffffff',
                                    color: '#14b8a6',
                                    border: '1px solid rgba(226, 232, 240, 0.8)',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)'
                                }}
                            >
                                {t('aboutUs.cta.button')}
                                <Send 
                                    className="w-5 h-5" 
                                    style={{ 
                                        color: '#14b8a6',
                                        transform: 'rotate(-45deg)'
                                    }} 
                                />
                            </button>
                        </div>
                </Container>
            </Section>

            {/* Footer */}
            <footer 
                className="py-8 px-4 border-t"
                style={{
                    background: 'var(--theme-bg-primary)',
                    borderColor: 'var(--theme-border-primary)'
                }}
            >
                <Container>
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center gap-2">
                            <Heart className="w-5 h-5" style={{ color: turquoise }} />
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
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                {t('aboutUs.trialForm.nameLabel')} <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="text"
                                    value={trialName}
                                    onChange={(e) => setTrialName(e.target.value)}
                                    placeholder={t('aboutUs.trialForm.namePlaceholder')}
                                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    dir="rtl"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* Phone Input */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                {t('aboutUs.trialForm.phoneLabel')} <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="tel"
                                    value={trialPhone}
                                    onChange={(e) => setTrialPhone(e.target.value.replace(/\D/g, ''))}
                                    placeholder={t('aboutUs.trialForm.phonePlaceholder')}
                                    className="w-full pr-10 pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                    dir="ltr"
                                    disabled={isSubmitting}
                                    maxLength={15}
                                />
                            </div>
                            <p className="text-xs text-white/50 mt-1">{t('aboutUs.trialForm.phoneExample')}</p>
                        </div>

                        {/* Required Branches Input - Enhanced with Dropdown */}
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
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
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={trialRequiredBranches}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 1;
                                            setTrialRequiredBranches(Math.max(1, Math.min(100, val)));
                                        }}
                                        placeholder="أو أدخل عدد مخصص (1-100)"
                                        className="w-full pr-10 pl-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                                        dir="ltr"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-white/50 mt-2">
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

            {/* Logo Animation Styles - Same as Login Screen */}
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
                @keyframes radarSweep {
                    from {
                        transform: translate(-50%, -50%) rotate(0deg);
                    }
                    to {
                        transform: translate(-50%, -50%) rotate(360deg);
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
                
                /* Twinkling stars animation */
                @keyframes twinkle {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.5); }
                }
                .animate-twinkle {
                    animation: twinkle ease-in-out infinite;
                }
                
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
                .radar-sweep {
                    will-change: transform;
                }
                
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
                
                /* Sparkle effects */
                .animate-sparkle {
                    animation: sparkle 2s ease-in-out infinite;
                }
                .animate-sparkle-delay {
                    animation: sparkle 2s ease-in-out infinite 0.5s;
                }
                .animate-sparkle-delay-2 {
                    animation: sparkle 2s ease-in-out infinite 1s;
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
