/**
 * Premium Login Screen - Adora Hotel Management System
 * Brand Identity: Teal/Turquoise (#14b8a6)
 * Mobile-First Design with Beautiful Animations
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Building2, Fingerprint, User, Crown, Shield, 
  CheckCircle, AlertCircle, Eye, EyeOff, Sun, Moon, Sunrise, Sunset
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../hooks/useUX';
import { useTheme } from '../../context/ThemeContext';
import { BiometricSetupModal } from '../../components/auth/BiometricSetupModal';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';
import {
  hasBiometricRegistered,
  isBiometricSupported,
  hasPermanentlySkippedBiometric
} from '../../services/biometricService';
import { isFirebaseConfigured } from '../../services/firebase';
import { 
  PinDot, 
  KeypadButton, 
  triggerHaptic,
  keypadAnimationStyles 
} from '../../components/ui/KeypadComponents';

// ============================================================
// DYNAMIC GREETING BASED ON TIME OF DAY (i18n-aware)
// ============================================================
const getDynamicGreeting = (t: (key: string) => string) => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return {
      greeting: t('greetings.morning'),
      message: t('auth.morningMessage'),
      icon: Sunrise,
      iconColor: 'text-amber-500',
      emoji: '☀️'
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: t('greetings.afternoon'),
      message: t('auth.afternoonMessage'),
      icon: Sun,
      iconColor: 'text-yellow-500',
      emoji: '🌤️'
    };
  } else if (hour >= 17 && hour < 21) {
    return {
      greeting: t('greetings.evening'),
      message: t('auth.eveningMessage'),
      icon: Sunset,
      iconColor: 'text-orange-500',
      emoji: '🌅'
    };
  } else {
    return {
      greeting: t('greetings.night'),
      message: t('auth.nightMessage'),
      icon: Moon,
      iconColor: 'text-indigo-400',
      emoji: '🌙'
    };
  }
};

// ============================================================
// NOTE: PinDot, KeypadButton, triggerHaptic imported from
// ../../components/ui/KeypadComponents.tsx for code reuse
// ============================================================

// ============================================================
// USER TYPE TAB
// ============================================================
const UserTypeTab: React.FC<{
  type: 'owner' | 'manager' | 'employee';
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
  isDark?: boolean;
}> = ({ active, onClick, icon, label, color, isDark = false }) => (
  <button
    onClick={() => {
      triggerHaptic('light');
      onClick();
    }}
    className={`
      flex-1 py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2
      transition-all duration-300 text-xs sm:text-sm font-medium
      ${active 
        ? `bg-gradient-to-r ${color} text-white shadow-lg` 
        : isDark 
          ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
          : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
      }
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// ============================================================
// MAIN LOGIN SCREEN
// ============================================================
const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { login, loginWithBiometric, isAuthenticated, isLoading: authLoading, user: authUser } = useAuth();
  const { showInfo } = useUX();
  const { theme, toggleTheme, isDark } = useTheme();

  // State
  const [userType, setUserType] = useState<'owner' | 'manager' | 'employee'>('employee');
  const [branchCode, setBranchCode] = useState('');
  const [pin, setPin] = useState('');
  const [activeInput, setActiveInput] = useState<'branch' | 'pin'>('branch'); // Which input is active
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [lastLoggedInUser, setLastLoggedInUser] = useState<{ userId: string; tenantId: string } | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // ✅ FIX: State for developer settings (auto-updates from owner dashboard)
  const [devConfig, setDevConfig] = useState(() => {
    try {
      return {
        devName: localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda',
        phoneSA: localStorage.getItem('adora_dev_phone_sa') || '966570707121',
        phoneEG: localStorage.getItem('adora_dev_phone_eg') || '201500000162',
        email: localStorage.getItem('adora_dev_email') || '77aayy@gmail.com',
      };
    } catch {
      return {
        devName: 'Ayman Abo Warda',
        phoneSA: '966570707121',
        phoneEG: '201500000162',
        email: '77aayy@gmail.com',
      };
    }
  });

  // ✅ FIX: Load from Firebase on mount (with localStorage as fallback)
  useEffect(() => {
    const loadDeveloperSettings = async () => {
      try {
        const { getSystemSettings } = await import('../../services/systemSettingsService');
        const settings = await getSystemSettings();
        if (settings?.developerBranding) {
          const branding = settings.developerBranding;
          const newConfig = {
            devName: branding.devName || devConfig.devName,
            phoneSA: branding.devPhoneSA || devConfig.phoneSA,
            phoneEG: branding.devPhoneEG || devConfig.phoneEG,
            email: branding.devEmail || devConfig.email,
          };
          
          // Update state
          setDevConfig(newConfig);
          
          // Sync to localStorage for backward compatibility
          if (branding.devName) localStorage.setItem('adora_dev_name', branding.devName);
          if (branding.devPhoneSA) localStorage.setItem('adora_dev_phone_sa', branding.devPhoneSA);
          if (branding.devPhoneEG) localStorage.setItem('adora_dev_phone_eg', branding.devPhoneEG);
          if (branding.devEmail) localStorage.setItem('adora_dev_email', branding.devEmail);
          if (branding.devSignature) localStorage.setItem('adora_dev_signature', branding.devSignature);
        }
      } catch (err) {
        console.warn('Failed to load developer settings from Firebase, using localStorage:', err);
      }
    };
    
    loadDeveloperSettings();
  }, []);
  
  // ✅ FIX: Listen for settings updates from owner dashboard
  useEffect(() => {
    const handleSettingsUpdate = (event: CustomEvent) => {
      const newConfig = event.detail;
      // Update state
      setDevConfig(newConfig);
      // Also update localStorage to ensure persistence
      if (newConfig.devName) localStorage.setItem('adora_dev_name', newConfig.devName);
      if (newConfig.phoneSA) localStorage.setItem('adora_dev_phone_sa', newConfig.phoneSA);
      if (newConfig.phoneEG) localStorage.setItem('adora_dev_phone_eg', newConfig.phoneEG);
      if (newConfig.email) localStorage.setItem('adora_dev_email', newConfig.email);
      if (newConfig.signature) localStorage.setItem('adora_dev_signature', newConfig.signature);
    };
    
    window.addEventListener('adora_dev_settings_updated', handleSettingsUpdate as EventListener);
    
    return () => {
      window.removeEventListener('adora_dev_settings_updated', handleSettingsUpdate as EventListener);
    };
  }, []);

  // Dynamic greeting based on time of day (i18n-aware)
  const greeting = useMemo(() => getDynamicGreeting(t), [t]);
  const GreetingIcon = greeting.icon;

  // ✅ Animation on mount - Delay to wait for splash/initial loader to disappear
  const [showLogin, setShowLogin] = useState(false);
  
  useEffect(() => {
    // ✅ Wait for splash screen and initial loader to disappear before showing login
    const checkAndShow = () => {
      const initialLoader = document.getElementById('initial-loader');
      const isLoaderHidden = !initialLoader || initialLoader.style.display === 'none' || initialLoader.style.opacity === '0';
      
      // Check if splash is shown (via localStorage)
      const hasShownSplash = localStorage.getItem('adora_splash_shown');
      
      // Wait 800ms after initial loader disappears (or 3000ms if splash is showing)
      // 3000ms = 2500ms splash duration + 300ms fade + 200ms delay for smooth transition
      const delay = hasShownSplash ? 800 : 3000;
      
      setTimeout(() => {
        setShowLogin(true);
        setTimeout(() => setMounted(true), 150);
      }, delay);
    };
    
    checkAndShow();
  }, []);

  // 🔐 Check if Firebase is configured - redirect to setup if not
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      console.log('🔧 Firebase not configured - redirecting to setup...');
      navigate('/firebase-setup', { replace: true });
    }
  }, [navigate]);

  // Magic link handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // 🔐 SECURITY: Basic validation (inline to prevent circular deps)
    const rawMagicCode = params.get('setup_code');
    const rawHotelName = params.get('welcome');
    
    // Basic validation: alphanumeric + basic punctuation, max 100 chars
    const magicCode = rawMagicCode && /^[a-zA-Z0-9\s\-\._,]{1,100}$/.test(rawMagicCode) ? rawMagicCode : null;
    const hotelName = rawHotelName && /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9\s\-\._,]{1,100}$/.test(rawHotelName) ? rawHotelName : null;

    if (magicCode) {
      setBranchCode(magicCode);
      setUserType('employee');
      showInfo(hotelName ? t('auth.welcomeToHotel', { hotel: hotelName }) : t('auth.welcomeToAdora'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [showInfo, t]);

  // Check biometric support
  useEffect(() => {
    setBiometricSupported(isBiometricSupported());
  }, []);

  // Auto redirect if logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated && authUser && location.pathname === '/login') {
      if (authUser.role === 'owner') {
        navigate('/owner-dashboard', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, authUser, navigate, location.pathname]);

  // Check for biometric after login
  useEffect(() => {
    const checkBiometricAfterLogin = async () => {
      if (lastLoggedInUser) {
        // Check if already registered
        const hasBiometric = await hasBiometricRegistered(
          lastLoggedInUser.userId,
          lastLoggedInUser.tenantId
        );
        
        // Check if permanently skipped (after 5 skips)
        const permanentlySkipped = hasPermanentlySkippedBiometric(
          lastLoggedInUser.userId,
          lastLoggedInUser.tenantId
        );
        
        // Only show if: supported + not registered + not permanently skipped
        if (!hasBiometric && biometricSupported && !permanentlySkipped) {
          setShowBiometricSetup(true);
        }
      }
    };
    checkBiometricAfterLogin();
  }, [lastLoggedInUser, biometricSupported]);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Get config based on user type
  const getConfig = () => {
    switch (userType) {
      case 'owner':
        return { showBranch: false, pinLength: 6, pinLabel: t('auth.ownerPinLabel'), branchLength: 0 };
      case 'manager':
        return { showBranch: false, pinLength: 4, pinLabel: t('auth.managerPinLabel'), branchLength: 0 };
      case 'employee':
        return { showBranch: true, pinLength: 4, pinLabel: t('auth.employeePinLabel'), branchLength: 4 };
    }
  };

  const config = getConfig();

  // Keypad handler
  const handleKeyPress = useCallback((key: string) => {
    if (isLoading) return;

    if (key === 'delete') {
      triggerHaptic('light');
      // Delete from active input
      if (userType === 'employee') {
        if (activeInput === 'pin' && pin.length > 0) {
          setPin(p => p.slice(0, -1));
        } else if (activeInput === 'pin' && pin.length === 0) {
          // Switch to branch when PIN is empty and delete is pressed
          setActiveInput('branch');
          setBranchCode(p => p.slice(0, -1));
        } else {
          setBranchCode(p => p.slice(0, -1));
        }
      } else {
        setPin(p => p.slice(0, -1));
      }
      return;
    }

    triggerHaptic('light');

    // For employee: fill based on active input
    if (userType === 'employee') {
      if (activeInput === 'branch') {
        if (branchCode.length < config.branchLength) {
          setBranchCode(p => p + key);
          // Auto-switch to PIN after entering branch code (when 4 digits or user clicks PIN field)
        }
      } else {
        // Active input is PIN
        if (pin.length < config.pinLength) {
          setPin(p => p + key);
        }
      }
    } else {
      // For owner/manager: only PIN
      if (pin.length < config.pinLength) {
        setPin(p => p + key);
      }
    }
  }, [userType, branchCode, pin, isLoading, config, activeInput]);

  // ✅ Auto-submit when PIN is complete - INSTANT LOGIN
  useEffect(() => {
    const isComplete = userType === 'employee' 
      ? (branchCode.length >= 1 && pin.length === config.pinLength)
      : pin.length === config.pinLength;
    
    if (isComplete && !isLoading) {
      // Instant auto-login with minimal delay for visual feedback
      const timer = setTimeout(() => {
        triggerHaptic('success');
        handleLogin();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pin, branchCode, userType, config.pinLength, isLoading]);

  // Login handler
  const handleLogin = async () => {
    // Validation
    if (userType === 'employee') {
      if (branchCode.length === 0) {
        setError(t('auth.enterBranchCodeFirst'));
        triggerHaptic('error');
        return;
      }
      if (pin.length < config.pinLength) {
        setError(t('auth.enterEmployeeCode', { digits: config.pinLength }));
        triggerHaptic('error');
        return;
      }
    } else {
      if (pin.length < config.pinLength) {
        setError(t('auth.enterFullCode', { digits: config.pinLength }));
        triggerHaptic('error');
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const effectiveBranch = userType === 'employee' ? branchCode : '';
      const result = await login(pin, effectiveBranch);

      triggerHaptic('success');
      setSuccess(t('auth.loginSuccess') || 'تم تسجيل الدخول بنجاح! ✨');

      setTimeout(async () => {
        if (authUser) {
          setLastLoggedInUser({
            userId: authUser.id,
            tenantId: authUser.tenantId
          });
        }
      }, 100);

      // Navigate after success
      setTimeout(() => {
        if (result.role === 'owner') {
          navigate('/owner-dashboard', { replace: true });
        } else {
          navigate(result.path || '/admin');
        }
      }, 600);

    } catch (err: any) {
      triggerHaptic('error');
      
      // ✅ Better error messages for common issues
      let errorMessage = err.message || t('auth.wrongCode');
      
      // If error mentions Anonymous Auth or configuration-not-found
      if (errorMessage.includes('Anonymous Authentication') || errorMessage.includes('configuration-not-found')) {
        errorMessage = '⚠️ Anonymous Authentication غير مفعل في Firebase Console.\n\n📍 الحل:\nFirebase Console → Authentication → Sign-in method → Anonymous → Enable';
      } else if (errorMessage.includes('offline') || errorMessage.includes('الاتصال')) {
        errorMessage = '⚠️ لا يوجد اتصال بالإنترنت.\n\nيرجى التحقق من الاتصال والمحاولة مرة أخرى.';
      }
      
      setError(errorMessage);
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  // Biometric login
  const handleBiometricLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const path = await loginWithBiometric();
      triggerHaptic('success');
      navigate(path || '/admin');
    } catch (err: any) {
      triggerHaptic('error');
      setError(err.message || t('auth.biometricFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Reset when user type changes
  useEffect(() => {
    setBranchCode('');
    setPin('');
    setError(null);
    setActiveInput('branch'); // Reset to branch for employees
  }, [userType]);

  return (
    <div 
      className={`fixed inset-0 ${isDark ? 'bg-slate-950' : 'bg-teal-50'}`}
      style={{ transition: 'background-color 1.5s ease-in-out' }}
    >
      {/* 🌓 Theme Toggle - Minimal Professional */}
      <button
        onClick={() => {
          toggleTheme();
          triggerHaptic('medium');
        }}
        className={`
          fixed top-4 right-4 z-[9999]
          w-10 h-10 rounded-full
          flex items-center justify-center
          transition-all duration-500 transform hover:scale-105 active:scale-95
          ${isDark 
            ? 'bg-slate-800/80 text-amber-300 border border-slate-600/50' 
            : 'bg-white/80 text-slate-600 border border-slate-200/50'
          }
          backdrop-blur-sm shadow-sm
        `}
        aria-label={isDark ? t('auth.dayMode') : t('auth.nightMode')}
      >
        {isDark ? (
          <Sun className="w-5 h-5" />
        ) : (
          <Moon className="w-5 h-5" />
        )}
      </button>

      <div 
        className="min-h-screen flex flex-col items-center justify-between p-4 py-6 relative overflow-hidden transition-all duration-[1500ms] ease-in-out"
        style={{ 
          minHeight: '100dvh'
        }}
      >
        {/* 🌅 Premium Animated Background - Theme-aware with Sunset Effect */}
        <div className={`absolute inset-0 premium-bg transition-all duration-[1500ms] ease-in-out ${isDark ? 'opacity-0' : 'opacity-100'}`}>
          {/* ☀️ LIGHT MODE - Bright Morning Sky */}
          {/* Base gradient - Richer colors */}
          <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50" />
          
          {/* Animated aurora gradient */}
          <div className="absolute inset-0 aurora-gradient" />
          
          {/* Wave decoration at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-64 wave-bg" />
          
          {/* Large floating orbs with stronger colors */}
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] orb orb-1" />
          <div className="absolute -bottom-32 -right-32 w-[450px] h-[450px] orb orb-2" />
          <div className="absolute top-1/3 right-0 w-[350px] h-[350px] orb orb-3" />
          
          {/* Hexagon pattern */}
          <div className="absolute inset-0 hex-pattern" />
          
          {/* Floating shapes */}
          <div className="shape shape-1">◆</div>
          <div className="shape shape-2">○</div>
          <div className="shape shape-3">◇</div>
          <div className="shape shape-4">●</div>
          <div className="shape shape-5">△</div>
          
          {/* Glowing accent spots */}
          <div className="absolute top-10 right-10 w-48 h-48 bg-gradient-to-br from-teal-400/30 to-cyan-400/20 rounded-full blur-3xl glow-pulse" />
        </div>
        
        {/* 🌙 DARK MODE - Night Sky with Stars */}
        <div className={`absolute inset-0 transition-all duration-[1500ms] ease-in-out ${isDark ? 'opacity-100' : 'opacity-0'}`}>
          {/* Deep night sky gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
          
          {/* Sunset/Sunrise glow at horizon */}
          <div className={`absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-orange-900/20 via-purple-900/10 to-transparent transition-opacity duration-[2000ms] ${isDark ? 'opacity-100' : 'opacity-0'}`} />
          
          {/* Aurora borealis effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
            <div className="absolute top-20 right-1/4 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/10 via-indigo-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          </div>
          
          {/* Twinkling stars */}
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
          
          {/* Removed moon from corner - now around logo */}
          
          {/* Shooting star occasional */}
          <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-white rounded-full animate-shooting-star" />
          
          {/* Subtle clouds/mist at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-900/50 to-transparent" />
        </div>
        
        {/* Common elements that adapt */}
        <div className={`absolute inset-0 transition-opacity duration-[1500ms] ${isDark ? 'opacity-30' : 'opacity-100'}`}>
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-64 h-64 corner-decoration corner-tl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 corner-decoration corner-br" />
        </div>
        
        {/* Glowing accent - changes color based on theme */}
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
        className={`w-full max-w-xs sm:max-w-sm relative z-10 transition-all duration-1000 ease-out px-2 sm:px-0 ${
          mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
        }`}
        style={{
          animation: mounted ? 'loginEntrance 0.8s ease-out forwards' : 'none'
        }}
      >
        {/* Logo & Dynamic Greeting - Compact for Mobile */}
        <div className="text-center mb-4 sm:mb-6">
          {/* Animated Logo Container with Half-Circle Theme Indicator */}
          <div className="relative inline-flex items-center justify-center mb-3 sm:mb-5" style={{ width: 'clamp(140px, 40vw, 220px)', height: 'clamp(140px, 40vw, 220px)' }}>
            {/* Base glowing effect */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`absolute w-full h-full rounded-full blur-3xl animate-pulse transition-colors duration-1000 ${
                isDark ? 'bg-gradient-to-br from-amber-400/10 to-orange-400/10' : 'bg-gradient-to-br from-teal-400/10 to-cyan-400/10'
              }`} />
            </div>
            
            {/* 🌙☀️ Half-Circle Theme Ring - Thin Line */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div 
                className="absolute w-full h-full rounded-full transition-all duration-1000"
                style={{
                  background: isDark
                    ? 'conic-gradient(from 180deg, #fef3c7 0deg, rgba(254,243,199,0.7) 90deg, rgba(254,243,199,0.3) 160deg, transparent 180deg, transparent 360deg)'
                    : 'conic-gradient(from 180deg, #fbbf24 0deg, rgba(251,191,36,0.7) 90deg, rgba(251,191,36,0.3) 160deg, transparent 180deg, transparent 360deg)',
                  opacity: isDark ? 0.8 : 0.7,
                  filter: isDark 
                    ? 'drop-shadow(0 0 8px rgba(253, 230, 138, 0.4))' 
                    : 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))',
                  mask: 'radial-gradient(circle, transparent 88%, black 90%, black 93%, transparent 95%)',
                  WebkitMask: 'radial-gradient(circle, transparent 88%, black 90%, black 93%, transparent 95%)',
                }}
              />
            </div>
            
            {/* 🪐 Orbital Rings with Planets - Beautiful & Visible */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Orbit 1 - Closest */}
              <div 
                className="absolute rounded-full animate-orbit-1"
                style={{ 
                  width: '80%', 
                  height: '80%',
                  border: `1px dashed ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(13, 148, 136, 0.35)'}`,
                }}
              >
                <div 
                  className={`absolute w-1.5 h-1.5 rounded-full ${isDark ? 'bg-amber-400/70' : 'bg-teal-500/70'}`}
                  style={{ top: '0%', left: '50%', transform: 'translate(-50%, -50%)' }}
                />
              </div>
              
              {/* Orbit 2 - Middle */}
              <div 
                className="absolute rounded-full animate-orbit-2"
                style={{ 
                  width: '95%', 
                  height: '95%',
                  border: `1px dashed ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(13, 148, 136, 0.25)'}`,
                }}
              >
                <div 
                  className={`absolute w-2 h-2 rounded-full ${isDark ? 'bg-cyan-400/60' : 'bg-cyan-600/60'}`}
                  style={{ top: '50%', right: '0%', transform: 'translate(50%, -50%)' }}
                />
              </div>
              
              {/* Orbit 3 - Outer */}
              <div 
                className="absolute rounded-full animate-orbit-3"
                style={{ 
                  width: '110%', 
                  height: '110%',
                  border: `1px dashed ${isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(13, 148, 136, 0.18)'}`,
                }}
              >
                <div 
                  className={`absolute w-1 h-1 rounded-full ${isDark ? 'bg-purple-400/50' : 'bg-emerald-500/50'}`}
                  style={{ bottom: '0%', left: '50%', transform: 'translate(-50%, 50%)' }}
                />
              </div>
            </div>
            
            {/* Main Logo */}
            <div className="relative z-10">
              <img
                src="/adora-logo.png"
                alt={t('auth.welcomeMessage')}
                className="logo-float logo-crisp"
                style={{ 
                  width: 'clamp(80px, 25vw, 160px)',
                  height: 'auto',
                  filter: isDark 
                    ? 'drop-shadow(0 10px 30px rgba(251, 191, 36, 0.3))' 
                    : 'drop-shadow(0 10px 30px rgba(20, 184, 166, 0.4))',
                  transition: 'filter 1s ease-in-out'
                }}
                loading="eager"
                decoding="sync"
              />
            </div>
            
            {/* Sparkle effects */}
            <div className={`absolute -top-1 right-2 w-2.5 h-2.5 sm:w-4 sm:h-4 rounded-full animate-sparkle ${isDark ? 'bg-amber-300' : 'bg-yellow-400'}`} />
            <div className={`absolute top-1/4 -left-1 w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-sparkle-delay ${isDark ? 'bg-orange-300' : 'bg-cyan-400'}`} />
            <div className={`absolute -bottom-1 right-1/4 w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-sparkle-delay-2 ${isDark ? 'bg-yellow-200' : 'bg-teal-300'}`} />
          </div>

          {/* Dynamic Welcome Message - Compact */}
          <div className="space-y-1 sm:space-y-2 animate-fade-up">
            <p className={`flex items-center justify-center gap-2 text-lg sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-teal-800'}`}>
              <span className="text-xl sm:text-3xl">{greeting.emoji}</span>
              <span className={`bg-clip-text text-transparent ${isDark ? 'bg-gradient-to-r from-teal-300 to-cyan-300' : 'bg-gradient-to-r from-teal-700 to-teal-500'}`}>
                {greeting.greeting}
              </span>
              <GreetingIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${greeting.iconColor} animate-bounce-gentle`} />
            </p>
            <p className={`text-xs sm:text-base font-medium ${isDark ? 'text-slate-300' : 'text-teal-600'}`}>
              {t('auth.welcomeMessage')}
            </p>
            <p className={`text-[10px] sm:text-sm italic hidden sm:block ${isDark ? 'text-slate-400' : 'text-teal-500/80'}`}>
              ✨ {greeting.message} ✨
            </p>
          </div>
        </div>

        {/* Main Card - Compact on mobile, Theme-aware */}
        <div 
          className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl transition-all duration-500 ${
            isDark 
              ? 'bg-slate-800/95 border-slate-700 shadow-slate-900/30' 
              : 'bg-white border-teal-100 shadow-teal-900/10'
          } border`}
        >
          {/* User Type Tabs */}
          <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-5">
            <UserTypeTab
              type="employee"
              active={userType === 'employee'}
              onClick={() => setUserType('employee')}
              icon={<User className="w-4 h-4" />}
              label={t('auth.employee')}
              color="from-teal-500 to-teal-600 shadow-teal-500/30"
              isDark={isDark}
            />
            <UserTypeTab
              type="manager"
              active={userType === 'manager'}
              onClick={() => setUserType('manager')}
              icon={<Shield className="w-4 h-4" />}
              label={t('auth.manager')}
              color="from-blue-500 to-blue-600 shadow-blue-500/30"
              isDark={isDark}
            />
            <UserTypeTab
              type="owner"
              active={userType === 'owner'}
              onClick={() => setUserType('owner')}
              icon={<Crown className="w-4 h-4" />}
              label={t('auth.owner')}
              color="from-amber-500 to-amber-600 shadow-amber-500/30"
              isDark={isDark}
            />
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          {/* Branch Code (Employee only) - Clickable to switch input */}
          {config.showBranch && (
            <div 
              className={`mb-4 p-3 rounded-xl cursor-pointer transition-all ${
                activeInput === 'branch' 
                  ? isDark 
                    ? 'bg-teal-900/30 border-2 border-teal-500 shadow-sm' 
                    : 'bg-teal-50 border-2 border-teal-400 shadow-sm'
                  : isDark
                    ? 'bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500'
                    : 'bg-slate-50 border-2 border-slate-200 shadow-sm hover:border-slate-300'
              }`}
              onClick={() => {
                setActiveInput('branch');
                triggerHaptic('light');
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 ${activeInput === 'branch' ? 'text-teal-500' : isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${activeInput === 'branch' ? isDark ? 'text-teal-400' : 'text-teal-700' : isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('auth.branchCodeLabel')}</span>
                  {activeInput === 'branch' && <span className="text-xs text-teal-500 animate-pulse">● {t('auth.activeLabel')}</span>}
                </div>
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{branchCode.length}/1-4</span>
              </div>
              <div className="flex justify-center gap-2">
                {[...Array(config.branchLength)].map((_, i) => (
                  <PinDot 
                    key={`branch-${i}`} 
                    filled={i < branchCode.length} 
                    value={branchCode[i]}
                    showValue={true}
                    index={i}
                    isDark={isDark}
                  />
                ))}
              </div>
              {activeInput === 'branch' && branchCode.length > 0 && (
                <p className={`text-center text-xs mt-2 ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                  ✓ {t('auth.afterBranchEnterPin') || 'بعد إدخال كود الفرع، اضغط على "كود الموظف" للمتابعة'}
                </p>
              )}
            </div>
          )}

          {/* PIN Code - Clickable to switch input */}
          <div 
            className={`mb-5 p-3 rounded-xl cursor-pointer transition-all ${
              activeInput === 'pin' || userType !== 'employee'
                ? isDark 
                  ? 'bg-teal-900/30 border-2 border-teal-500 shadow-sm'
                  : 'bg-teal-50 border-2 border-teal-400 shadow-sm' 
                : isDark
                  ? 'bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500'
                  : 'bg-slate-50 border-2 border-slate-200 shadow-sm hover:border-slate-300'
            }`}
            onClick={() => {
              if (userType === 'employee') {
                setActiveInput('pin');
                triggerHaptic('light');
              }
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {userType === 'owner' && <Crown className={`w-4 h-4 text-amber-500`} />}
                {userType === 'manager' && <Shield className={`w-4 h-4 text-blue-500`} />}
                {userType === 'employee' && <User className={`w-4 h-4 ${activeInput === 'pin' ? 'text-teal-500' : 'text-slate-400'}`} />}
                <span className={`text-sm font-medium ${activeInput === 'pin' || userType !== 'employee' ? isDark ? 'text-teal-400' : 'text-teal-700' : isDark ? 'text-slate-300' : 'text-slate-500'}`}>{config.pinLabel}</span>
                {(activeInput === 'pin' || userType !== 'employee') && <span className="text-xs text-teal-500 animate-pulse">● {t('auth.activeLabel')}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{pin.length}/{config.pinLength}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPin(!showPin);
                  }}
                  className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-100'}`}
                >
                  {showPin ? (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              {[...Array(config.pinLength)].map((_, i) => (
                <PinDot 
                  key={`pin-${i}`} 
                  filled={i < pin.length} 
                  value={pin[i]}
                  showValue={showPin}
                  index={i}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>

          {/* Keypad - LTR for correct number layout (1 left, 3 right) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4" dir="ltr">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <KeypadButton
                key={n}
                value={String(n)}
                onClick={() => handleKeyPress(String(n))}
                disabled={isLoading}
                isDark={isDark}
              />
            ))}
            {/* Delete button on left */}
            <KeypadButton
              value="delete"
              variant="delete"
              onClick={() => handleKeyPress('delete')}
              disabled={isLoading}
              isDark={isDark}
            />
            <KeypadButton
              value="0"
              onClick={() => handleKeyPress('0')}
              disabled={isLoading}
              isDark={isDark}
            />
            {/* Login/Biometric button - Same size as other buttons with prominent glow */}
            <button
              onClick={biometricSupported ? handleBiometricLogin : handleLogin}
              disabled={isLoading}
              className={`h-14 sm:h-16 rounded-xl flex items-center justify-center
                         bg-gradient-to-br from-teal-500 to-teal-600 text-white
                         shadow-[0_0_20px_rgba(20,184,166,0.5),0_4px_12px_rgba(20,184,166,0.3)]
                         hover:shadow-[0_0_30px_rgba(20,184,166,0.6),0_6px_16px_rgba(20,184,166,0.4)]
                         active:scale-95 transition-all disabled:opacity-50`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Fingerprint className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>

          {/* Instructions */}
          <p className={`text-center text-xs mt-3 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
            {userType === 'employee' 
              ? (t('auth.enterBranchThenEmployee') || 'أدخل كود الفرع (1-4 أرقام) ثم كود الموظف (4 أرقام)')
              : userType === 'manager'
                ? (t('auth.enterManagerCode') || 'أدخل كود المدير (4 أرقام)')
                : (t('auth.enterOwnerCode') || 'أدخل كود المالك (6 أرقام)')
            }
          </p>

          {/* Forgot Code Link - Opens WhatsApp */}
          <button
            type="button"
            onClick={() => {
              // ✅ FIX: Get developer info from state (auto-updates)
              const devPhone = devConfig.phoneSA || '966570707121';
              const branchName = localStorage.getItem('adora_branch_name') || t('auth.branchNotSpecified');
              const message = encodeURIComponent(
                t('auth.forgotCodeMessage', { branch: branchName })
              );
              window.open(`https://wa.me/${devPhone}?text=${message}`, '_blank');
            }}
            className={`w-full mt-3 py-2 text-center text-sm transition-colors ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'} hover:underline`}
          >
            🔑 {t('auth.forgotCode')}
          </button>
        </div>

        {/* Biometric Setup Modal */}
        {showBiometricSetup && lastLoggedInUser && (
          <BiometricSetupModal
            onComplete={() => {
              setShowBiometricSetup(false);
              setLastLoggedInUser(null);
            }}
            onSkip={() => {
              setShowBiometricSetup(false);
              setLastLoggedInUser(null);
            }}
          />
        )}
        
        {/* Developer Signature - Professional Single Line - Below content */}
        <footer 
          className="w-full py-2 mt-4 text-center pointer-events-auto relative z-20"
          dir="ltr"
        >
          <p 
            className="text-[8px] sm:text-[9px] tracking-wide transition-all duration-300 flex items-center justify-center gap-1.5 flex-wrap"
            style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
          >
          {/* Copyright */}
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            © {new Date().getFullYear()}
          </span>
          <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
          
                {/* Developer Name */}
                <span className={`font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                  {devConfig.devName}
                </span>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Saudi Phone */}
                <a 
                  href={`https://wa.me/${devConfig.phoneSA}?text=${encodeURIComponent((() => {
                    const hour = new Date().getHours();
                    return hour >= 5 && hour < 12 ? (t('auth.goodMorning') || 'صباح الخير، أنا مهتم بمشروعك') : (t('auth.goodEvening') || 'مساء الخير، أنا مهتم بمشروعك');
                  })())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`hover:underline transition-colors ${
                    isDark 
                      ? 'text-slate-300 hover:text-teal-400' 
                      : 'text-slate-600 hover:text-teal-600'
                  }`}
                >
                  +{devConfig.phoneSA}
                </a>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Egypt Phone */}
                <a 
                  href={`https://wa.me/${devConfig.phoneEG}?text=${encodeURIComponent((() => {
                    const hour = new Date().getHours();
                    return hour >= 5 && hour < 12 ? (t('auth.goodMorning') || 'صباح الخير، أنا مهتم بمشروعك') : (t('auth.goodEvening') || 'مساء الخير، أنا مهتم بمشروعك');
                  })())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`hover:underline transition-colors ${
                    isDark 
                      ? 'text-slate-300 hover:text-teal-400' 
                      : 'text-slate-600 hover:text-teal-600'
                  }`}
                >
                  +{devConfig.phoneEG}
                </a>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Developer Email */}
                <a 
                  href={`mailto:${devConfig.email}`}
                  className={`hover:underline transition-colors ${
                    isDark 
                      ? 'text-slate-300 hover:text-teal-400' 
                      : 'text-slate-600 hover:text-teal-600'
                  }`}
                >
                  {devConfig.email}
                </a>
          </p>
        </footer>
      </div>

      {/* Global Animations & Premium Background Styles */}
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        /* ============================================
           PREMIUM BACKGROUND EFFECTS
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
        
        /* Floating orbs - Enhanced */
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
        
        /* Animated decorative lines */
        .line {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(20, 184, 166, 0.3), transparent);
          animation: lineMove 8s linear infinite;
        }
        .line-1 {
          top: 20%;
          left: -100%;
          width: 200%;
          animation-delay: 0s;
        }
        .line-2 {
          top: 50%;
          left: -100%;
          width: 200%;
          animation-delay: -2.5s;
          opacity: 0.5;
        }
        .line-3 {
          top: 80%;
          left: -100%;
          width: 200%;
          animation-delay: -5s;
          opacity: 0.3;
        }
        @keyframes lineMove {
          0% { transform: translateX(0) rotate(-2deg); }
          100% { transform: translateX(50%) rotate(-2deg); }
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
        
        /* ============================================
           LOGO ANIMATIONS
           ============================================ */
        
        /* Logo floating animation */
        .logo-float {
          animation: logoFloat 4s ease-in-out infinite;
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-6px) rotate(1deg); }
          50% { transform: translateY(-12px) rotate(0deg); }
          75% { transform: translateY(-6px) rotate(-1deg); }
        }
        
        /* Slow ping for rings */
        .animate-ping-slow {
          animation: pingSlow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes pingSlow {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }
        
        /* Slow spin for outer ring */
        .animate-spin-slow {
          animation: spinSlow 20s linear infinite;
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* 🪐 Orbital animations - Planets around the sun */
        .animate-orbit-1 {
          animation: orbit 12s linear infinite;
        }
        .animate-orbit-2 {
          animation: orbit 18s linear infinite reverse;
        }
        .animate-orbit-3 {
          animation: orbit 25s linear infinite;
        }
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
        
        /* Gentle bounce for icon */
        .animate-bounce-gentle {
          animation: bounceGentle 2s ease-in-out infinite;
        }
        @keyframes bounceGentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        
        /* Fade up animation */
        .animate-fade-up {
          animation: fadeUp 0.8s ease-out forwards;
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        /* Logo container entrance */
        .logo-container {
          animation: logoEntrance 1s ease-out forwards;
        }
        @keyframes logoEntrance {
          0% { 
            opacity: 0; 
            transform: scale(0.5) rotate(-10deg); 
          }
          60% { 
            transform: scale(1.1) rotate(3deg); 
          }
          100% { 
            opacity: 1; 
            transform: scale(1) rotate(0deg); 
          }
        }
        
        /* Ultra crisp logo rendering */
        .logo-crisp {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* For high DPI screens */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .logo-crisp {
            image-rendering: auto;
          }
        }
        
        /* ✨ Twinkling stars animation */
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        .animate-twinkle {
          animation: twinkle ease-in-out infinite;
        }
        
        /* 🌠 Shooting star animation */
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
        
        /* 🌅 Sunset transition overlay */
        @keyframes sunsetGlow {
          0% { opacity: 0; }
          50% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        
        /* 🌙 Gentle moon sway animation */
        @keyframes moonSway {
          0%, 100% { 
            transform: translateY(0) rotate(-5deg); 
          }
          50% { 
            transform: translateY(-8px) rotate(5deg); 
          }
        }
        .animate-moon-sway {
          animation: moonSway 6s ease-in-out infinite;
        }
        
        /* Very slow spin for sun rays */
        @keyframes spinVerySlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-very-slow {
          animation: spinVerySlow 30s linear infinite;
        }
        
        /* ✅ Beautiful login entrance animation */
        @keyframes loginEntrance {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          60% {
            opacity: 0.8;
            transform: translateY(-5px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
      </div>
    </div>
  );
};

export default LoginScreen;
