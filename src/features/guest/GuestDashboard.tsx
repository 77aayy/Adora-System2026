/**
 * Guest Dashboard - COMPLETE EXPANDED Implementation
 * All 70 functions from legacy guest.js
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Sparkles, Wrench, BellRing, Coffee, Package, Clock,
    History, ChevronDown, Star, Phone, MessageCircle,
    Bell, Moon, Sun, ChevronRight, AlertCircle, CheckCircle,
    X, Camera, Send, ShoppingCart, Plus, Minus, RefreshCw,
    MapPin, Smartphone, DoorClosed, QrCode,
    // 🆕 Professional icons for verification
    CreditCard, Fingerprint, Sunrise, Sunset, CloudSun, Stars,
    // 🆕 Final step icon - "Open System"
    Unlock, LogIn
} from 'lucide-react';
// 🆕 Shared Keypad Components for unified design
import { 
    PinDot, 
    KeypadButton, 
    triggerHaptic,
    getDynamicGreeting,
    keypadAnimationStyles 
} from '../../components/ui/KeypadComponents';
import { useTheme } from '../../context/ThemeContext';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, Timestamp, getDocs } from 'firebase/firestore';
import { ReadReceipt } from '../../components/shared/ReadReceipt';
import { RequestModal } from './RequestModal';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';
// ✅ Location & Device Limit Services
import {
    verifyGuestLocation,
    getDeviceLimitSettings,
    checkDeviceLimit,
    generateDeviceFingerprint,
    getCurrentLocation,
    getSavedLocationPermission,
    getSavedLocationData,
    saveLocationPermission,
    saveDeviceFingerprint,
    getSavedDeviceFingerprint,
    saveLastVerification,
    getLastVerification,
    getLocationSettings,
    performComprehensiveCheck,
    isDeviceBlocked,
    recordFailedAttempt,
    clearFailedAttempts,
    notifyReceptionOfSuspiciousActivity
} from '../../services/locationService';
// 🔐 Secure Access Service (Token-based)
import {
    validateSecureAccessToken,
    isLegacyInsecureAccess,
    logSecurityEvent
} from '../../services/secureAccessService';
// 🔐 Anonymous Auth & Rate Limiting (Budget Protection)
import {
    ensureAnonymousAuth,
    ensureGuestCanAct,
    recordRateLimitedAction,
    checkRateLimit,
    initializeGuestRateLimit,
    RATE_LIMITS
} from '../../services/anonymousAuthService';
import { getActiveRoomCard } from '../../services/roomCardService';
import { subscribeToQRServices, createRequestFromQRService, type QRService } from '../../services/qrServiceService';
import { subscribeToRatingInvitations, submitRatingResponse, markInvitationAsShown, dismissRatingInvitation, type RatingInvitation, type RatingTemplate } from '../../services/ratingService';
import { subscribeToAnnouncements, getAnnouncementReadStatus, markAnnouncementAsRead, getVisibleAnnouncements, getUnreadAnnouncementsCount, type Announcement } from '../../services/announcementService';
import { subscribeToEmergencyAlerts, getAlertReadStatus, markAlertAsRead, dismissAlert, requestNotificationPermission, showBrowserNotification, playAlertSound, type EmergencyAlert } from '../../services/emergencyAlertService';
import { haptic, playSound } from '../../utils/uxEffects';
import { GuestTourGuide } from '../../components/guest/GuestTourGuide';
// ✅ Room Transfer Service
import { subscribeToRoomTransfers } from '../../services/roomTransferService';
// 🆕 Guest Loyalty & Respect Score
import { findOrCreateGuest, getVipBadgeInfo, GuestProfile } from '../../services/guestLoyaltyService';
// ✅ Image Upload Service (ImgBB with compression)
import { uploadToImgBB } from '../../services/imageUploadService';
// 🆕 Identity Check Service (Phone Verification for QR Requests)
import { verifyGuestPhone, checkRoomBlockStatus } from '../../services/identityCheckService';
// 🆕 Smart Chat & VIP Theme
import { GuestChatWidget } from '../../components/guest/GuestChatWidget';
import { VIPGuestTheme, VIPWelcomeBanner } from '../../components/guest/VIPGuestTheme';
import { QuickIssueReporter } from '../../components/guest/QuickIssueReporter';
import { MicroFeedback } from '../../components/guest/MicroFeedback';

// ============================================================
// TYPES
// ============================================================

interface GuestSession {
    roomNumber: string;
    guestName: string;
    guestIdentity?: string;
    guestPhone?: string;
    branch: string;
    hotelId: string;
    verifiedAt: Date;
}

interface GuestRequest {
    id: string;
    type: string;
    serviceType: string;
    status: string;
    roomNumber: string;
    createdAt: any;
    timeline?: any;
    rating?: number;
}

interface MenuItem {
    id: string;
    name: string;
    price: number;
    icon?: string;
    description?: string;
    category?: string;
}

interface ProductCart {
    [productId: string]: number;
}

// ============================================================
// SERVICE CONFIGURATION
// ============================================================

interface ServiceItem {
    type: string;
    name: string;
    nameAr: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
}

const SERVICES: ServiceItem[] = [
    {
        type: 'cleaning',
        name: 'Cleaning',
        nameAr: 'تنظيف الغرفة',
        icon: <Sparkles className="w-8 h-8" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
    },
    {
        type: 'maintenance',
        name: 'Maintenance',
        nameAr: 'صيانة',
        icon: <Wrench className="w-8 h-8" />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
    },
    {
        type: 'bellman',
        name: 'Bellman',
        nameAr: 'بيلمان',
        icon: <BellRing className="w-8 h-8" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
    },
    {
        type: 'room_service',
        name: 'Room Service',
        nameAr: 'خدمة الغرف',
        icon: <Coffee className="w-8 h-8" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
    },
    {
        type: 'minibar',
        name: 'Mini Bar',
        nameAr: 'ميني بار',
        icon: <Package className="w-8 h-8" />,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
    },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export const GuestDashboard: React.FC = () => {
    console.log('🚀 [GuestDashboard] Component rendered!');
    // 🌙 Theme Support
    const { theme, toggleTheme, isDark } = useTheme();
    
    // Guest Session
    const [session, setSession] = useState<GuestSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [verifyType, setVerifyType] = useState<'identity' | 'phone' | null>(null);
    const [verifyValue, setVerifyValue] = useState('');
    const [verifyError, setVerifyError] = useState('');
    const [verifyFirstName, setVerifyFirstName] = useState(''); // 🆕 اختياري للنزيل
    const [verifyPhone, setVerifyPhone] = useState(''); // 🆕 إجباري لتسجيل النزيل
    const [isReturningGuest, setIsReturningGuest] = useState(false); // 🆕 نزيل سابق
    const [guestVipLevel, setGuestVipLevel] = useState<string | null>(null); // 🆕 مستوى VIP
    
    // 🆕 Step-based verification with Keypad
    const [inputStep, setInputStep] = useState<'identity' | 'phone' | 'contact'>('identity');
    const [identityDigits, setIdentityDigits] = useState<string[]>(['', '', '', '']); // 4 خانات للهوية
    const [phoneDigits, setPhoneDigits] = useState(''); // رقم الجوال (مرن)

    // Secure Access State
    const [resolvedRoom, setResolvedRoom] = useState<string | null>(null);
    const [resolvedBranch, setResolvedBranch] = useState<string | null>(null);
    const [resolvedTenant, setResolvedTenant] = useState<string | null>(null); // 🆕 Tenant ID
    const [authError, setAuthError] = useState<string | null>(null);
    
    // ✅ Demo Mode - For trial buyers (view only, no real requests)
    const [isDemoMode, setIsDemoMode] = useState(false);
    
    // ✅ Room Not Active - Show welcome page but block requests
    const [isRoomNotActive, setIsRoomNotActive] = useState(false);
    
    // ✅ Location & Device State
    const [locationError, setLocationError] = useState<string | null>(null);
    const [deviceError, setDeviceError] = useState<string | null>(null);
    const [roomStatusError, setRoomStatusError] = useState<string | null>(null);
    const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);

    // Current Tab
    const [currentTab, setCurrentTab] = useState<'services' | 'history' | 'extras'>('services');

    // Active Requests
    const [activeRequests, setActiveRequests] = useState<GuestRequest[]>([]);
    const [recentRequests, setRecentRequests] = useState<GuestRequest[]>([]);

    // Request Tracker
    const [trackedRequest, setTrackedRequest] = useState<GuestRequest | null>(null);

    // Do Not Disturb
    const [doNotDisturb, setDoNotDisturb] = useState(false);

    // Request Modal
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
    const [requestNotes, setRequestNotes] = useState('');
    const [requestPhoto, setRequestPhoto] = useState<string | null>(null);
    const [scheduleTime, setScheduleTime] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Rating Modal
    const [ratingRequest, setRatingRequest] = useState<GuestRequest | null>(null);
    const [ratingValue, setRatingValue] = useState(0);

    // Product Menus
    const [coffeeMenu, setCoffeeMenu] = useState<MenuItem[]>([]);
    const [minibarMenu, setMinibarMenu] = useState<MenuItem[]>([]);
    const [coffeeCart, setCoffeeCart] = useState<ProductCart>({});
    const [minibarCart, setMinibarCart] = useState<ProductCart>({});
    const [showCoffeeModal, setShowCoffeeModal] = useState(false);
    const [showMinibarModal, setShowMinibarModal] = useState(false);

    // Branch Settings
    const [branchSettings, setBranchSettings] = useState<any>(null);
    
    // ✅ Rate Limiting - منع الطلبات المتكررة
    const [requestTimestamps, setRequestTimestamps] = useState<number[]>([]);
    const RATE_LIMIT_MAX_REQUESTS = 5; // أقصى عدد طلبات
    const RATE_LIMIT_WINDOW_MS = 60000; // في دقيقة واحدة (60 ثانية)

    // Out of Hours Modal
    const [outOfHoursService, setOutOfHoursService] = useState<string | null>(null);
    
    // Emergency Request Modal
    const [showEmergencyModal, setShowEmergencyModal] = useState(false);
    const [emergencyServiceType, setEmergencyServiceType] = useState<string | null>(null);
    const [emergencyNotes, setEmergencyNotes] = useState('');
    const [emergencyPhoto, setEmergencyPhoto] = useState<string | null>(null);

    // 🆕 Phone Verification for QR Requests (Security Enhancement)
    const [showPhoneVerificationModal, setShowPhoneVerificationModal] = useState(false);
    const [phoneVerificationDigits, setPhoneVerificationDigits] = useState<string>('');
    const [phoneVerificationError, setPhoneVerificationError] = useState<string>('');
    const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
    const [roomBlockedUntil, setRoomBlockedUntil] = useState<Date | null>(null);

    // Dynamic QR Services
    const [dynamicServices, setDynamicServices] = useState<QRService[]>([]);
    const [selectedQRService, setSelectedQRService] = useState<QRService | null>(null);
    const [qrServiceFormData, setQRServiceFormData] = useState<Record<string, any>>({});
    const [showQRServiceModal, setShowQRServiceModal] = useState(false);

    // Dynamic Rating System
    const [ratingInvitation, setRatingInvitation] = useState<any>(null);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingResponses, setRatingResponses] = useState<Record<string, any>>({});
    const [ratingSubmitting, setRatingSubmitting] = useState(false);
    
    // 🆕 Guest Toast (replaces native alert - Modern UX)
    const [guestToast, setGuestToast] = useState<{ show: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string; } | null>(null);
    
    // Helper to show toast (auto-hides after 4s)
    const showGuestToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string) => {
        setGuestToast({ show: true, type, message });
        haptic?.(type === 'success' ? 'success' : 'error');
        setTimeout(() => setGuestToast(null), 4000);
    }, []);

    // Announcements System
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [announcementReadStatuses, setAnnouncementReadStatuses] = useState<Record<string, any>>({});
    const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Emergency Alerts System
    const [emergencyAlerts, setEmergencyAlerts] = useState<any[]>([]);
    const [alertReadStatuses, setAlertReadStatuses] = useState<Record<string, any>>({});
    const [showEmergencyAlertModal, setShowEmergencyAlertModal] = useState(false);
    const [currentEmergencyAlert, setCurrentEmergencyAlert] = useState<any>(null);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

    // ✅ Room Transfer Notification
    const [roomTransferNotification, setRoomTransferNotification] = useState<{ newRoom: string; message: string } | null>(null);

    // Refs
    const photoInputRef = useRef<HTMLInputElement>(null);
    const emergencyPhotoInputRef = useRef<HTMLInputElement>(null);
    const previousAlertIdsRef = useRef<string[]>([]); // 🔧 FIX: Moved from inside useEffect to top-level

    // ============================================================
    // INITIALIZATION
    // ============================================================

    useEffect(() => {
        console.log('🚀 [GuestDashboard] useEffect triggered - calling initGuestPage');
        initGuestPage().catch((error) => {
            console.error('❌ [GuestDashboard] initGuestPage failed:', error);
        });
    }, []);

    // ✅ FIX: Real-time listeners with proper cleanup (prevents Zombie Listeners)
    useEffect(() => {
        if (!session) return;

        // Subscribe to active requests
        const unsubscribeActive = listenForActiveRequests(session);
        
        // Subscribe to completed requests (for auto-rating)
        const unsubscribeCompleted = listenForCompletedRequests(session);

        // ✅ Cleanup function - CRITICAL to prevent Zombie Listeners
        return () => {
            if (unsubscribeActive) unsubscribeActive();
            if (unsubscribeCompleted) unsubscribeCompleted();
        };
    }, [session]); // Re-subscribe when session changes

    const initGuestPage = async () => {
        console.log('🚀 [GuestDashboard] initGuestPage started');
        console.log('🚀 [GuestDashboard] Current URL:', window.location.href);
        updateDynamicGreeting();

        // 🔐 STEP 1: Ensure Anonymous Authentication (Budget Protection!)
        // This prevents unauthorized API reads and enables rate limiting
        console.log('🔐 Initializing guest session with Anonymous Auth...');
        const anonUser = await ensureAnonymousAuth();
        if (!anonUser) {
            console.error('❌ Failed to create anonymous session');
            setAuthError('فشل في إنشاء جلسة آمنة. تأكد من تفعيل Anonymous Auth في Firebase Console.');
            setLoading(false);
            return;
        }
        console.log('✅ Anonymous session created:', anonUser.uid);

        // Helper to get param from search or hash
        const getParam = (key: string) => {
            const searchParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
            return searchParams.get(key) || hashParams.get(key);
        };

        // 🛡️ SECURITY: Ignore room/branch/tenant from URL - they can be manipulated!
        // Only trust data from Token validation
        const urlRoomNum = getParam('room'); // For logging only - NOT used for security
        const urlBranchId = getParam('branch'); // For logging only - NOT used for security
        const urlTenantId = getParam('tenantId') || getParam('hotelId'); // For logging only - NOT used for security
        
        // 🔐 SECURITY: Token is the ONLY source of truth
        const token = getParam('t') || getParam('token');
        console.log('🔍 [GuestDashboard] Token from URL:', token ? `${token.substring(0, 8)}...` : 'NOT FOUND');
        console.log('⚠️ [GuestDashboard] SECURITY: Ignoring URL params (can be manipulated):', {
            room: urlRoomNum,
            branch: urlBranchId,
            tenant: urlTenantId
        });
        
        // Initialize as null - will be set from Token validation only
        let roomNum: string | null = null;
        let branchId: string | null = null;
        let tenantId: string | null = null;
        
        // ✅ Check for Demo Mode (for trial buyers)
        const demo = getParam('demo');
        if (demo === 'true') {
            setIsDemoMode(true);
            console.log('🎮 Demo Mode Activated - Requests will NOT be sent');
        }

        // 🛡️ SECURITY CHECK: Detect legacy insecure access (IDOR vulnerability)
        // Block access if room/branch/tenant are in URL but NO token (insecure direct access)
        const searchParams = new URLSearchParams(window.location.search);
        if (isLegacyInsecureAccess(searchParams) && !demo) {
            console.warn('🚨 [GuestDashboard] SECURITY: Legacy insecure access detected - blocking');
            
            // Log suspicious activity
            const fingerprint = getSavedDeviceFingerprint() || generateDeviceFingerprint();
            logSecurityEvent({
                action: 'SUSPICIOUS_ACTIVITY',
                roomNumber: urlRoomNum || undefined,
                branchId: urlBranchId || undefined,
                tenantId: urlTenantId || undefined,
                deviceFingerprint: fingerprint,
                userAgent: navigator.userAgent,
                reason: 'Attempted access with direct room parameter without secure token'
            });
            
            setAuthError('عذراً، الرابط الذي استخدمته غير آمن.\n\nيرجى مسح رمز QR الموجود في غرفتك للحصول على رابط آمن ومشفر. هذا يضمن حماية بياناتك وأمان وصولك للخدمات.\n\nنعتذر عن أي إزعاج.');
            setLoading(false);
            return;
        }

        // 🔒 Secure Token Resolution (REQUIRED unless demo mode)
        if (token) {
            try {
                console.log(`🔍 [GuestDashboard] Token found in URL: ${token.substring(0, 8)}...`);
                // Get device fingerprint for security tracking
                const fingerprint = getSavedDeviceFingerprint() || generateDeviceFingerprint();
                saveDeviceFingerprint(fingerprint);
                console.log(`🔍 [GuestDashboard] Calling validateSecureAccessToken...`);
                
                // Validate token using secure service
                const validationResult = await validateSecureAccessToken(token, fingerprint);
                console.log(`🔍 [GuestDashboard] Validation result:`, {
                    valid: validationResult.valid,
                    errorCode: validationResult.errorCode,
                    error: validationResult.error?.substring(0, 50)
                });
                
                if (!validationResult.valid) {
                    console.warn(`🔐 Token validation failed: ${validationResult.errorCode}`);
                    
                    // ✅ Map error codes to user-friendly, polite, and very clear messages
                    const errorMessages: Record<string, string> = {
                        'INVALID_TOKEN': 'عذراً، الرابط الذي استخدمته غير صالح أو تم إلغاؤه.\n\nيرجى التأكد من أنك تستخدم الرابط الصحيح الموجود في غرفتك. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال للحصول على رابط جديد.',
                        'EXPIRED_TOKEN': 'عذراً، انتهت صلاحية رابط الوصول الخاص بغرفتك.\n\nيرجى التواصل مع الاستقبال للحصول على رابط جديد. نحن في خدمتك دائماً.',
                        'INACTIVE_TOKEN': 'عذراً، رابط الوصول الخاص بغرفتك غير نشط حالياً.\n\nقد يكون هذا بسبب تسجيل الخروج من الغرفة. يرجى التواصل مع الاستقبال لتجديد الرابط أو التحقق من حالة الحجز.',
                        'DEVICE_LIMIT': 'عذراً، تم الوصول للحد الأقصى من الأجهزة المسموح بها لهذه الغرفة (3 أجهزة).\n\nإذا كنت بحاجة لاستخدام جهاز إضافي، يرجى التواصل مع الاستقبال وسنسعد بمساعدتك.',
                        'NO_ACTIVE_CHECKIN': 'عذراً، يبدو أن غرفتك غير مسجلة دخول حالياً في النظام.\n\nيرجى التوجه إلى الاستقبال لإتمام عملية تسجيل الدخول أولاً. بعد ذلك، سيعمل رابط QR الخاص بغرفتك تلقائياً.\n\nنعتذر عن أي إزعاج ونتمنى لك إقامة سعيدة.',
                        'SYSTEM_ERROR': 'عذراً، حدث خطأ تقني غير متوقع أثناء التحقق من الرابط.\n\nيرجى المحاولة مرة أخرى بعد قليل. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال وسنسعد بمساعدتك فوراً.'
                    };
                    
                    setAuthError(validationResult.error || errorMessages[validationResult.errorCode || 'SYSTEM_ERROR']);
                    setLoading(false);
                    return;
                }
                
                // 🛡️ SECURITY: Token is valid - extract data FROM TOKEN ONLY (ignore URL params)
                // This is the ONLY source of truth - URL params can be manipulated!
                roomNum = validationResult.data!.roomNumber;
                branchId = validationResult.data!.branchId;
                tenantId = validationResult.data!.tenantId;
                
                // 🛡️ DOUBLE VALIDATION: If URL has room param, verify it matches token data
                // This detects IDOR (Insecure Direct Object Reference) attacks
                if (urlRoomNum && urlRoomNum !== roomNum) {
                    console.error('🚨 [GuestDashboard] SECURITY BREACH DETECTED: Room mismatch!', {
                        urlRoom: urlRoomNum,
                        tokenRoom: roomNum,
                        action: 'BLOCKED'
                    });
                    // Log security event
                    logSecurityEvent({
                        action: 'ROOM_MISMATCH_ATTEMPT',
                        roomNumber: urlRoomNum,
                        tokenRoomNumber: roomNum,
                        branchId: branchId || undefined,
                        tenantId: tenantId || undefined,
                        deviceFingerprint: fingerprint,
                        userAgent: navigator.userAgent,
                        reason: 'User attempted to access different room by manipulating URL parameter'
                    });
                    // Show error and block access
                    setAuthError('عذراً، تم اكتشاف محاولة غير مصرح بها للوصول.\n\nيرجى استخدام الرابط الصحيح الموجود في غرفتك. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال.');
                    setLoading(false);
                    return;
                }
                
                // 🛡️ DOUBLE VALIDATION: If URL has branch param, verify it matches token data
                if (urlBranchId && urlBranchId !== branchId) {
                    console.error('🚨 [GuestDashboard] SECURITY BREACH DETECTED: Branch mismatch!', {
                        urlBranch: urlBranchId,
                        tokenBranch: branchId,
                        action: 'BLOCKED'
                    });
                    logSecurityEvent({
                        action: 'BRANCH_MISMATCH_ATTEMPT',
                        branchId: urlBranchId,
                        tokenBranchId: branchId,
                        roomNumber: roomNum || undefined,
                        tenantId: tenantId || undefined,
                        deviceFingerprint: fingerprint,
                        userAgent: navigator.userAgent,
                        reason: 'User attempted to access different branch by manipulating URL parameter'
                    });
                    setAuthError('عذراً، تم اكتشاف محاولة غير مصرح بها للوصول.\n\nيرجى استخدام الرابط الصحيح الموجود في غرفتك. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال.');
                    setLoading(false);
                    return;
                }
                
                // 🛡️ DOUBLE VALIDATION: If URL has tenant param, verify it matches token data
                if (urlTenantId && urlTenantId !== tenantId) {
                    console.error('🚨 [GuestDashboard] SECURITY BREACH DETECTED: Tenant mismatch!', {
                        urlTenant: urlTenantId,
                        tokenTenant: tenantId,
                        action: 'BLOCKED'
                    });
                    logSecurityEvent({
                        action: 'TENANT_MISMATCH_ATTEMPT',
                        tenantId: urlTenantId,
                        tokenTenantId: tenantId,
                        roomNumber: roomNum || undefined,
                        branchId: branchId || undefined,
                        deviceFingerprint: fingerprint,
                        userAgent: navigator.userAgent,
                        reason: 'User attempted to access different tenant by manipulating URL parameter'
                    });
                    setAuthError('عذراً، تم اكتشاف محاولة غير مصرح بها للوصول.\n\nيرجى استخدام الرابط الصحيح الموجود في غرفتك. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال.');
                    setLoading(false);
                    return;
                }
                
                console.log('✅ [GuestDashboard] SECURITY: Token validated - using data from token ONLY (URL params ignored):', {
                    room: roomNum,
                    branch: branchId,
                    tenant: tenantId
                });
                
                setResolvedRoom(roomNum);
                setResolvedBranch(branchId);
                
                // 🔐 Initialize rate limiting for this guest session
                await initializeGuestRateLimit(tenantId, roomNum);
                
                console.log(`🔐 Secure token validated for Room ${roomNum}`);
                
            } catch (error) {
                console.error("Token resolution error:", error);
                setAuthError('عذراً، حدث خطأ تقني أثناء التحقق من رابط الوصول.\n\nيرجى المحاولة مرة أخرى بعد قليل. إذا استمرت المشكلة، يرجى التواصل مع الاستقبال وسنسعد بمساعدتك فوراً.');
                setLoading(false);
                return;
            }
        } else if (!demo) {
            // 🚨 No token and not demo mode - require secure access
            console.log('⚠️ [GuestDashboard] No token found in URL and not demo mode');
            // Allow existing session to continue (for page refresh)
            const existingSession = checkExistingSession();
            if (!existingSession) {
                console.log('⚠️ [GuestDashboard] No existing session found - showing default message');
                setAuthError('مرحباً بك في فندق أدورا 🌟\n\nيرجى مسح رمز QR الموجود في غرفتك للوصول إلى خدمات الفندق.\n\nإذا كنت ترى هذه الرسالة بعد المسح، يرجى التواصل مع الاستقبال وسنسعد بمساعدتك فوراً.');
                setLoading(false);
                return;
            }
            // If there's an existing session, let it continue below
            console.log('📱 Continuing with existing session (no token in URL)');
        }

        // 🚨 CRITICAL: SaaS Hierarchy Enforcement
        // A guest CANNOT proceed without a valid Tenant Context
        if (!tenantId) {
            // Check existing session for tenantId
            const existingSession = checkExistingSession();
            if (existingSession?.hotelId) {
                tenantId = existingSession.hotelId;
            } else {
                console.error("🚨 Critical Error: Missing Tenant Context (tenantId)");
                setAuthError('خطأ في النظام: لا يوجد سياق للفندق (Missing Context)');
                setLoading(false);
                return;
            }
        }

        // Context is valid, proceed
        console.log(`✅ Tenant Context Verified: ${tenantId} | Branch: ${branchId || 'Main'}`);

        const existingSession = checkExistingSession();
        if (existingSession) {
            // Verify session matches current context (if provided)
            if (roomNum && existingSession.roomNumber !== roomNum) {
                // If URL specifies a DIFFERENT room than session, we might want to clear session
                // But typically sticky session is better. 
                // For security, if token is used, we trust token.
            }

            const verified = await verifyActiveRoomCard(existingSession);
            if (verified) {
                // ✅ Perform comprehensive QR checks (Location + Device + Room Status) with localStorage
                if (tenantId && branchId && roomNum) {
                    try {
                        const checkResult = await performComprehensiveCheck(tenantId, branchId, roomNum);
                        
                        if (!checkResult.allowed) {
                            // Set specific errors
                            if (!checkResult.roomValid) {
                                setRoomStatusError(checkResult.errors.find(e => e.includes('دخول') || e.includes('QR') || e.includes('الغرفة')) || 'الغرفة غير متاحة');
                            }
                            if (!checkResult.deviceValid) {
                                setDeviceError(checkResult.errors.find(e => e.includes('جهاز') || e.includes('device')) || 'تم الوصول للحد الأقصى للأجهزة');
                            }
                            if (!checkResult.locationValid) {
                                setLocationError(checkResult.errors.find(e => e.includes('موقع') || e.includes('location') || e.includes('GPS')) || 'الموقع غير صحيح');
                            }
                            // Don't block access completely, just show warnings
                        } else {
                            // Clear errors if check passed
                            setLocationError(null);
                            setDeviceError(null);
                            setRoomStatusError(null);
                        }
                    } catch (error) {
                        console.error('Error performing comprehensive check:', error);
                        // On error, don't block access but log it
                    }
                }
                
                setSession(existingSession);
                await loadBranchSettings(existingSession.branch, existingSession.hotelId);
                // ✅ FIX: Listeners are now handled in useEffect (see below) for proper cleanup
                // listenForActiveRequests(existingSession);
                // listenForCompletedRequests(existingSession); // Auto-rating listener
                await loadRecentRequests(existingSession);
                await loadCoffeeMenu(existingSession);
                await loadMinibarMenu(existingSession);
                
                // Dynamic QR services are loaded via useEffect subscription (real-time updates)
            } else {
                clearSession();
            }
        }
        setLoading(false);
    };

    // ============================================================
    // GREETING & UI
    // ============================================================

    const updateDynamicGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'صباح الخير';
        if (hour < 17) return 'مساء الخير';
        return 'مساء الخير';
    };

    const getPersonalizedGreeting = (name: string): string => {
        const greeting = updateDynamicGreeting();
        return `${greeting}، ${name}`;
    };

    const extractRoomFromURL = (): string | null => {
        if (resolvedRoom) return resolvedRoom;
        const params = new URLSearchParams(window.location.search);
        return params.get('room');
    };

    const extractBranchFromURL = (): string | null => {
        if (resolvedBranch) return resolvedBranch;
        const params = new URLSearchParams(window.location.search);
        return params.get('branch');
    };

    // ============================================================
    // SESSION MANAGEMENT
    // ============================================================

    const checkExistingSession = (): GuestSession | null => {
        const stored = localStorage.getItem('guest_session');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return null;
            }
        }
        return null;
    };

    const saveSession = (sessionData: GuestSession) => {
        localStorage.setItem('guest_session', JSON.stringify(sessionData));
        setSession(sessionData);
    };

    const clearSession = () => {
        localStorage.removeItem('guest_session');
        setSession(null);
    };

    const logoutGuest = () => {
        clearSession();
        window.location.reload();
    };

    // ============================================================
    // VERIFICATION
    // ============================================================

    const showVerifyInput = (type: 'identity' | 'phone') => {
        setVerifyType(type);
        setVerifyValue('');
        setVerifyFirstName(''); // Reset first name
        setVerifyError('');
        // 🆕 Reset keypad state
        setIdentityDigits(['', '', '', '']);
        setPhoneDigits('');
        setInputStep(type === 'identity' ? 'identity' : 'phone');
    };
    
    // 🆕 Haptic Feedback - imported from KeypadComponents
    
    // 🆕 Keypad Handler for Identity (4 digits) - RTL: Fill from RIGHT to LEFT
    const handleIdentityKeyPress = (key: string) => {
        triggerHaptic('light');
        
        if (key === 'delete') {
            const newDigits = [...identityDigits];
            // Find first filled position (from left, which is last entered in RTL)
            for (let i = 0; i < 4; i++) {
                if (newDigits[i] !== '') {
                    newDigits[i] = '';
                    setIdentityDigits(newDigits);
                    break;
                }
            }
        } else if (key === 'clear') {
            setIdentityDigits(['', '', '', '']);
        } else if (/^[0-9]$/.test(key)) {
            const newDigits = [...identityDigits];
            // RTL: Find last empty position (fill from right to left)
            // Array: [0, 1, 2, 3] → Display RTL: [3, 2, 1, 0]
            // So fill from index 3 down to 0
            for (let i = 3; i >= 0; i--) {
                if (newDigits[i] === '') {
                    newDigits[i] = key;
                    setIdentityDigits(newDigits);
                    
                    // 🎯 Auto-advance to phone input after 4 digits (when index 0 is filled)
                    if (i === 0) {
                        triggerHaptic('success');
                        setTimeout(() => {
                            setVerifyValue(newDigits.join(''));
                            setInputStep('contact');
                        }, 300);
                    }
                    break;
                }
            }
        }
    };
    
    // 🆕 Keypad Handler for Phone (flexible length)
    const handlePhoneKeyPress = (key: string) => {
        triggerHaptic('light');
        
        if (key === 'delete') {
            setPhoneDigits(prev => prev.slice(0, -1));
        } else if (key === 'clear') {
            setPhoneDigits('');
        } else if (/^[0-9]$/.test(key)) {
            setPhoneDigits(prev => prev + key);
        }
    };
    
    // 🆕 Submit verification from keypad
    const handleKeypadSubmit = async () => {
        const room = extractRoomFromURL();
        if (!room) return;
        
        triggerHaptic('medium');
        
        if (verifyType === 'identity') {
            // التحقق من اكتمال البيانات
            const idValue = identityDigits.join('');
            if (idValue.length !== 4) {
                setVerifyError('الرجاء إدخال 4 أرقام');
                triggerHaptic('error');
                return;
            }
            if (!phoneDigits || phoneDigits.length < 5) {
                setVerifyError('الرجاء إدخال رقم جوال صحيح');
                triggerHaptic('error');
                return;
            }
            
            // Set values for verification
            setVerifyValue(idValue);
            setVerifyPhone(phoneDigits);
            
            // Proceed with verification
            const verified = await verifyGuestIdentity(room, idValue, 'identity', verifyFirstName);
            if (verified) {
                triggerHaptic('success');
                // ✅ Skip completeGuestLogin in demo mode (session already set in verifyGuestIdentity)
                if (!isDemoMode) {
                    await completeGuestLogin(room, phoneDigits);
                }
            }
        } else if (verifyType === 'phone') {
            if (!phoneDigits || phoneDigits.length < 5) {
                setVerifyError('الرجاء إدخال رقم جوال صحيح');
                triggerHaptic('error');
                return;
            }
            
            setVerifyValue(phoneDigits);
            
            const verified = await verifyGuestIdentity(room, phoneDigits, 'phone', verifyFirstName);
            if (verified) {
                triggerHaptic('success');
                // ✅ Skip completeGuestLogin in demo mode (session already set in verifyGuestIdentity)
                if (!isDemoMode) {
                    await completeGuestLogin(room, phoneDigits);
                }
            }
        }
    };
    
    // 🆕 Complete login and create session
    const completeGuestLogin = async (room: string, guestPhoneNumber: string) => {
        try {
            const tenantId = new URLSearchParams(window.location.search).get('hotel') || resolvedTenant;
            if (tenantId && guestPhoneNumber) {
                const guestProfile = await findOrCreateGuest(tenantId, guestPhoneNumber, verifyFirstName);
                if (guestProfile) {
                    setIsReturningGuest(guestProfile.totalStays > 1);
                    const vipInfo = getVipBadgeInfo(guestProfile.respectScore);
                    if (vipInfo) setGuestVipLevel(vipInfo.level);
                }
            }

            setSession({
                roomNumber: room,
                guestName: verifyFirstName || 'ضيف',
                guestIdentity: verifyType === 'identity' ? identityDigits.join('') : undefined,
                guestPhone: guestPhoneNumber,
                branch: resolvedBranch || '',
                hotelId: resolvedTenant || '',
                verifiedAt: new Date()
            });
        } catch (error) {
            console.error('Error completing guest login:', error);
            triggerHaptic('error');
            setVerifyError('عذراً، حدث خطأ أثناء إتمام عملية الدخول.\nيرجى المحاولة مرة أخرى، وإذا استمرت المشكلة يرجى التواصل مع الاستقبال.');
        }
    };

    const verifyGuestIdentity = async (room: string, identity: string, type: 'identity' | 'phone', firstName?: string): Promise<boolean> => {
        try {
            // 🎮 DEMO MODE BYPASS - Allow access without real roomCard
            if (isDemoMode) {
                console.log('🎮 Demo Mode: Bypassing verification - allowing access');
                // Create a mock session for demo mode
                setSession({
                    roomNumber: room,
                    guestName: firstName || 'نزيل تجريبي',
                    guestIdentity: type === 'identity' ? identity : undefined,
                    guestPhone: type === 'phone' ? identity : '0512345678',
                    branch: resolvedBranch || 'demo-branch',
                    hotelId: resolvedTenant || 'demo-hotel',
                    verifiedAt: new Date()
                });
                return true;
            }
            
            // ✅ Check if device is blocked first
            const blockStatus = isDeviceBlocked();
            if (blockStatus.blocked) {
                triggerHaptic('error');
                setVerifyError(`🚫 تم حظر هذا الجهاز مؤقتاً بسبب محاولات فاشلة متكررة.\n\nيرجى الانتظار ${blockStatus.remainingMinutes} دقيقة أو التواصل مع الاستقبال.\n\nThis device is temporarily blocked.\nPlease wait ${blockStatus.remainingMinutes} minutes.`);
                return false;
            }
            
            const roomCardsRef = collection(db, 'roomCards');
            const q = query(
                roomCardsRef,
                where('roomNumber', '==', room),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                // ✅ Record failed attempt
                const attemptResult = recordFailedAttempt();
                if (attemptResult.shouldBlock) {
                    setVerifyError('🚫 تم حظر هذا الجهاز مؤقتاً لمدة 30 دقيقة.\n\nيرجى التواصل مع الاستقبال للمساعدة.');
                    // 📢 إشعار الاستقبال
                    const urlParams = new URLSearchParams(window.location.search);
                    const tenantId = urlParams.get('tenantId') || '';
                    const branchId = urlParams.get('branch') || '';
                    if (tenantId && branchId) {
                        notifyReceptionOfSuspiciousActivity(tenantId, branchId, room, 'unknown', attemptResult.attempts);
                    }
                } else {
                    setVerifyError(`عذراً، لا يوجد حجز نشط مسجل لهذه الغرفة حالياً.\nيرجى التأكد من رقم الغرفة أو التواصل مع الاستقبال للمساعدة.\n\n⚠️ المحاولة ${attemptResult.attempts} من 3`);
                }
                return false;
            }

            const roomCard = snapshot.docs[0].data();

            if (type === 'identity' && roomCard.guestIdentity !== identity) {
                // ✅ Record failed attempt
                const attemptResult = recordFailedAttempt();
                if (attemptResult.shouldBlock) {
                    setVerifyError('🚫 تم حظر هذا الجهاز مؤقتاً لمدة 30 دقيقة.\n\nيرجى التواصل مع الاستقبال للمساعدة.');
                    // 📢 إشعار الاستقبال
                    if (roomCard.tenantId && roomCard.branchId) {
                        notifyReceptionOfSuspiciousActivity(roomCard.tenantId, roomCard.branchId, room, 'unknown', attemptResult.attempts);
                    }
                } else {
                    setVerifyError(`عذراً، الأرقام المدخلة لا تتطابق مع بيانات الحجز.\nيرجى التأكد من إدخال آخر 4 أرقام من الهوية أو جواز السفر المسجل عند الحجز.\n\n⚠️ المحاولة ${attemptResult.attempts} من 3`);
                }
                return false;
            }

            if (type === 'phone' && roomCard.guestPhone !== identity) {
                // ✅ Record failed attempt
                const attemptResult = recordFailedAttempt();
                if (attemptResult.shouldBlock) {
                    setVerifyError('🚫 تم حظر هذا الجهاز مؤقتاً لمدة 30 دقيقة.\n\nيرجى التواصل مع الاستقبال للمساعدة.');
                    // 📢 إشعار الاستقبال
                    if (roomCard.tenantId && roomCard.branchId) {
                        notifyReceptionOfSuspiciousActivity(roomCard.tenantId, roomCard.branchId, room, 'unknown', attemptResult.attempts);
                    }
                } else {
                    setVerifyError(`عذراً، رقم الجوال المدخل لا يتطابق مع الرقم المسجل في الحجز.\nيرجى التأكد من إدخال نفس الرقم المستخدم عند تسجيل الوصول.\n\n⚠️ المحاولة ${attemptResult.attempts} من 3`);
                }
                return false;
            }

            // ✅ Strict Branch Check
            // Ensure the room belongs to the requested branch (from URL)
            const urlBranch = extractBranchFromURL();
            if (urlBranch && roomCard.branch !== urlBranch) {
                console.error(`Branch Mismatch: Room belongs to ${roomCard.branch}, but URL requested ${urlBranch}`);
                setVerifyError('عذراً، يبدو أن رابط الوصول غير صحيح لهذه الغرفة.\nيرجى مسح رمز QR الموجود داخل غرفتك أو التواصل مع الاستقبال.');
                return false;
            }

            // 🆕 NEW: Create Verification Request for Reception
            const verificationData = {
                roomNumber: room,
                branchId: roomCard.branch || 'default',
                tenantId: roomCard.hotelId || 'default',
                firstName: firstName || null,  // اختياري للنزيل
                identityOrPhone: identity,
                verificationType: type,
                status: 'pending',
                createdAt: Timestamp.now(),
                expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000), // 5 minutes default (dynamic from settings)
            };

            const verificationRef = await addDoc(collection(db, 'guestVerifications'), verificationData);

            // 🆕 Wait for reception approval or timeout
            // This will be handled by real-time listener
            // For now, we'll implement immediate verification (will add listener in next step)

            const sessionData: GuestSession = {
                roomNumber: room,
                guestName: roomCard.guestName,
                guestIdentity: roomCard.guestIdentity,
                guestPhone: roomCard.guestPhone,
                branch: roomCard.branch || 'default',
                hotelId: roomCard.hotelId || 'default',
                verifiedAt: new Date()
            };

            saveSession(sessionData);
            await logGuestActivity('login', { type, verificationId: verificationRef.id });
            
            // ✅ Perform comprehensive QR checks after successful verification (Location + Device + Room Status)
            const tenantId = roomCard.hotelId || 'default';
            const branchId = roomCard.branch || 'default';
            const checkResult = await performComprehensiveCheck(tenantId, branchId, room);
            
            if (!checkResult.allowed) {
                // Set specific errors (but don't block access completely)
                if (!checkResult.roomValid) {
                    setRoomStatusError(checkResult.errors.find(e => e.includes('دخول') || e.includes('QR') || e.includes('الغرفة')) || 'الغرفة غير متاحة');
                }
                if (!checkResult.deviceValid) {
                    setDeviceError(checkResult.errors.find(e => e.includes('جهاز') || e.includes('device')) || 'تم الوصول للحد الأقصى للأجهزة');
                }
                if (!checkResult.locationValid) {
                    setLocationError(checkResult.errors.find(e => e.includes('موقع') || e.includes('location') || e.includes('GPS')) || 'الموقع غير صحيح');
                }
            } else {
                // Clear errors if check passed
                setLocationError(null);
                setDeviceError(null);
                setRoomStatusError(null);
                
                // ✅ Clear failed attempts on successful verification
                clearFailedAttempts();
            }
            
            return true;
        } catch (error: any) {
            console.error('Verification error:', error);
            
            // ✅ تحديد نوع الخطأ وعرض رسالة مناسبة
            let errorMessage = 'عذراً، حدث خطأ تقني أثناء التحقق من البيانات.';
            
            if (error?.code === 'unavailable' || error?.message?.includes('network') || error?.message?.includes('offline')) {
                errorMessage = '📶 يبدو أن هناك مشكلة في الاتصال بالإنترنت.\n\nيرجى التحقق من اتصالك والمحاولة مرة أخرى.';
            } else if (error?.code === 'permission-denied') {
                errorMessage = '🔒 ليس لديك صلاحية للوصول لهذه البيانات.\n\nيرجى التواصل مع الاستقبال.';
            } else if (error?.message?.includes('quota')) {
                errorMessage = '⚠️ تم تجاوز حد الطلبات. يرجى الانتظار دقيقة والمحاولة مرة أخرى.';
            }
            
            errorMessage += '\n\nيرجى المحاولة مرة أخرى أو التواصل مع الاستقبال للمساعدة.';
            
            // Log detailed error for debugging
            console.error('Error details:', {
                code: error?.code,
                message: error?.message,
                room: room,
                type: type
            });
            
            setVerifyError(errorMessage);
            return false;
        }
    };

    const verifyActiveRoomCard = async (existingSession: GuestSession): Promise<boolean> => {
        try {
            const roomCardsRef = collection(db, 'roomCards');
            const q = query(
                roomCardsRef,
                where('roomNumber', '==', existingSession.roomNumber),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);

            // Re-verify branch match just to be safe if session was old
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();

                // 🔒 CLOSED LOOP SECURITY:
                // Verify the guest using this session is STILL the owner of the active card.
                // This handles the "Room Move" scenario where room 101 becomes occupied by NEW guest,
                // preventing the OLD guest (who moved to 202) from accessing 101.
                if (data.guestIdentity !== existingSession.guestIdentity) {
                    console.warn(`Session Invalidated: Room ${existingSession.roomNumber} is now occupied by ${data.guestName}, but session belongs to ${existingSession.guestName}`);
                    return false;
                }

                // Load DND state from roomCard
                if (data.doNotDisturb !== undefined) {
                    setDoNotDisturb(data.doNotDisturb);
                }
                return data.branch === existingSession.branch;
            }
            return false;
        } catch {
            return false;
        }
    };

    const proceedToServices = async () => {
        const room = extractRoomFromURL();
        if (!room || !verifyValue) return;

        // ✅ المنطق الذكي:
        // - لو التحقق بالهاتف: الرقم المُدخل نفسه هو رقم التواصل
        // - لو التحقق بالهوية: يجب إدخال رقم جوال منفصل للتواصل
        const guestPhoneNumber = verifyType === 'phone' ? verifyValue : verifyPhone;
        
        // التحقق من وجود رقم تواصل (فقط للهوية)
        if (verifyType === 'identity' && !verifyPhone) {
            setVerifyError('الرجاء إدخال رقم الجوال للتواصل');
            return;
        }

        const verified = await verifyGuestIdentity(room, verifyValue, verifyType!, verifyFirstName);
        if (verified) {
            // إنشاء/استرجاع ملف النزيل من قاعدة البيانات
            try {
                const tenantId = new URLSearchParams(window.location.search).get('hotel') || resolvedTenant;
                if (tenantId && guestPhoneNumber) {
                    const guestProfile = await findOrCreateGuest(
                        tenantId,
                        guestPhoneNumber,
                        verifyFirstName || undefined,
                        verifyFirstName || undefined
                    );
                    
                    // Check if returning guest
                    if (guestProfile.totalVisits > 1) {
                        setIsReturningGuest(true);
                        setGuestVipLevel(guestProfile.vipLevel);
                        
                        // Save guest ID in session for later use
                        localStorage.setItem('adora_guest_id', guestProfile.id);
                        localStorage.setItem('adora_guest_phone', guestPhoneNumber);
                    }
                }
            } catch (e) {
                console.error('Error with guest profile:', e);
                // Continue even if guest profile fails
            }

            setVerifyType(null);
            // Session is set inside verifyGuestIdentity, but state update might be async
            // Better to reload or rely on useEffect session change, but here we just wait
            // We rely on the useEffect that watches 'session' to trigger data load
        }
    };

    // ============================================================
    // LOGGING
    // ============================================================

    const logGuestActivity = async (action: string, details: any = {}) => {
        if (!session) return;
        try {
            await addDoc(collection(db, 'guest_activity'), {
                action,
                roomNumber: session.roomNumber,
                branch: session.branch,
                details,
                createdAt: Timestamp.now()
            });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    };

    // ============================================================
    // BRANCH SETTINGS & WORKING HOURS
    // ============================================================

    const loadBranchSettings = async (branch: string, hotelId: string) => {
        try {
            // Load branch settings
            // ✅ FIX: Use 'tenants' collection instead of 'hotels'
            const settingsRef = collection(db, `tenants/${hotelId}/branches/${branch}/settings`);
            const snapshot = await getDocs(settingsRef);
            let settings: any = {};
            if (!snapshot.empty) {
                settings = snapshot.docs[0].data();
            }

            // Load system settings (includes maintenanceMode)
            const systemRef = doc(db, `tenants/${hotelId}/branches/${branch}/settings`, 'system');
            const systemSnap = await getDoc(systemRef);
            if (systemSnap.exists()) {
                settings.system = systemSnap.data();
            }

            // Load working hours from branch-specific settings
            const workingHoursRef = doc(db, `tenants/${hotelId}/branches/${branch}/settings`, 'workingHours');
            const workingHoursSnap = await getDoc(workingHoursRef);
            if (workingHoursSnap.exists()) {
                settings.workingHours = workingHoursSnap.data();
            }

            // ✅ NEW: Load contact settings (whatsappNumber, receptionPhone)
            const contactRef = doc(db, `tenants/${hotelId}/branches/${branch}/settings`, 'contact');
            const contactSnap = await getDoc(contactRef);
            if (contactSnap.exists()) {
                const contactData = contactSnap.data();
                settings.whatsappNumber = contactData.whatsappNumber;
                settings.receptionPhone = contactData.receptionPhone;
            }

            // ✅ NEW: Load enabled services (Guest Portal Config)
            const servicesRef = doc(db, `tenants/${hotelId}/branches/${branch}/settings`, 'services');
            const servicesSnap = await getDoc(servicesRef);
            if (servicesSnap.exists()) {
                settings.enabledServices = servicesSnap.data().enabledServices;
            }

            // ✅ NEW: Load location settings (QR Location & Device Limit)
            // Location and device settings are already imported at the top
            const locationSettings = await getLocationSettings(hotelId, branch);
            const deviceSettings = await getDeviceLimitSettings(hotelId, branch);
            
            if (locationSettings) {
                settings.locationSettings = locationSettings;
            }
            if (deviceSettings) {
                settings.deviceSettings = deviceSettings;
            }

            setBranchSettings(settings);
        } catch (error) {
            console.error('Error loading branch settings:', error);
        }
    };

    const isServiceEnabled = (type: string): boolean => {
        // If no settings loaded yet, default to TRUE (show everything)
        if (!branchSettings?.enabledServices) return true;
        // If key exists, return it. If distinct key missing, default to true.
        return branchSettings.enabledServices[type] !== false;
    };

    const isDepartmentOpen = (serviceType: string): boolean => {
        if (!branchSettings?.workingHours) return true;

        // Map service type to department key (matches WorkingHoursSettings)
        const departmentKeyMap: Record<string, string> = {
            'cleaning': 'cleaning',
            'maintenance': 'maintenance',
            'bellman': 'bellman',
            'room_service': 'coffee', // Coffee shop
            'coffee': 'coffee',
            'coffee_shop': 'coffee',
            'reception': 'reception',
            'other': 'reception' // Default to reception for other services
        };

        const deptKey = departmentKeyMap[serviceType] || serviceType;
        const hours = branchSettings.workingHours[deptKey];

        if (!hours || hours.is24h) return true;

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        const [openHour, openMin] = (hours.open || '00:00').split(':').map(Number);
        const [closeHour, closeMin] = (hours.close || '23:59').split(':').map(Number);
        const openTime = openHour * 60 + openMin;
        const closeTime = closeHour * 60 + closeMin;

        if (openTime <= closeTime) {
            // Normal hours (e.g., 08:00 - 22:00)
            return currentTime >= openTime && currentTime <= closeTime;
        } else {
            // Overnight hours (e.g., 22:00 - 06:00)
            return currentTime >= openTime || currentTime <= closeTime;
        }
    };

    const getServiceDisplayName = (type: string): string => {
        const service = SERVICES.find(s => s.type === type);
        return service?.nameAr || type;
    };

    const showOutOfHoursModal = (serviceType: string) => {
        setOutOfHoursService(serviceType);
    };

    const closeOutOfHoursModal = () => {
        setOutOfHoursService(null);
    };

    const openEmergencyModal = (serviceType: string) => {
        setEmergencyServiceType(serviceType);
        setEmergencyNotes('');
        setEmergencyPhoto(null);
        setShowEmergencyModal(true);
        setOutOfHoursService(null);
    };

    const closeEmergencyModal = () => {
        setShowEmergencyModal(false);
        setEmergencyServiceType(null);
        setEmergencyNotes('');
        setEmergencyPhoto(null);
    };

    const handleEmergencyPhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setEmergencyPhoto(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const removeEmergencyPhoto = () => setEmergencyPhoto(null);

    const sendEmergencyWhatsApp = () => {
        if (!session || !emergencyServiceType) return;

        const number = branchSettings?.whatsappNumber || '966500000000';
        const serviceName = getServiceDisplayName(emergencyServiceType);
        
        let message = `🚨 *طلب طارئ*\n\n`;
        message += `غرفة رقم: ${session.roomNumber}\n`;
        message += `نوع الطلب: ${serviceName}\n`;
        
        if (emergencyServiceType === 'coffee' || emergencyServiceType === 'room_service') {
            // For coffee shop - include items if any
            const cart = coffeeCart;
            const menu = coffeeMenu;
            const items = Object.entries(cart)
                .filter(([_, qty]) => qty > 0)
                .map(([id, qty]) => {
                    const item = menu.find(m => m.id === id);
                    return `${item?.name || id} × ${qty}`;
                });
            
            if (items.length > 0) {
                message += `المنتجات المطلوبة:\n${items.join('\n')}\n`;
            }
        }
        
        if (emergencyNotes) {
            message += `\nالوصف: ${emergencyNotes}`;
        }
        
        if (emergencyServiceType === 'maintenance') {
            message += `\n\n*ملاحظة:* هذه حالة طارئة تتطلب اهتمام فوري.`;
        }

        const whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        // Log the emergency request
        logGuestActivity('emergency_request_sent', {
            serviceType: emergencyServiceType,
            notes: emergencyNotes,
            hasPhoto: !!emergencyPhoto
        });
        
        closeEmergencyModal();
    };

    // ============================================================
    // REQUEST MANAGEMENT
    // ============================================================

    // 🆕 Helper: Send Web Push Notification to Guest
    const sendGuestNotification = (title: string, body: string, icon?: string) => {
        // Check if browser supports notifications
        if (!('Notification' in window)) return;
        
        // Check permission
        if (Notification.permission === 'granted') {
            // Play sound
            playSound?.('notification');
            // Vibrate if supported
            triggerHaptic('success');
            
            // Show notification
            const notification = new Notification(title, {
                body,
                icon: icon || '/adora-logo.png',
                badge: '/icon-192x192.png',
                tag: 'adora-request-update',
                requireInteraction: false,
                silent: false
            });
            
            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
            
            // Focus window when clicked
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    };

    // 🆕 Helper: Get status message in Arabic
    const getStatusMessage = (status: string, serviceType?: string): { title: string; body: string } => {
        const serviceName = serviceType || 'طلبك';
        switch (status) {
            case 'CONFIRMED':
                return {
                    title: '✅ تم قبول طلبك',
                    body: `تم تأكيد ${serviceName} - سيصلك الموظف قريباً`
                };
            case 'IN_PROGRESS':
                return {
                    title: '🚀 جاري التنفيذ',
                    body: `الموظف في الطريق إليك لتنفيذ ${serviceName}`
                };
            case 'COMPLETED':
                return {
                    title: '🎉 تم إكمال الطلب',
                    body: `تم إنهاء ${serviceName} بنجاح - نتمنى لك إقامة سعيدة`
                };
            default:
                return { title: '', body: '' };
        }
    };

    const listenForActiveRequests = (sessionData: GuestSession) => {
        // ✅ Use tenant-scoped collection
        const tenantId = sessionData.hotelId || 'default';
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const q = query(
            requestsRef,
            where('roomNumber', '==', sessionData.roomNumber),
            where('branch', '==', sessionData.branch),
            where('status', 'in', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
        );

        // Track previous statuses to detect changes
        const previousStatuses = new Map<string, string>();

        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GuestRequest));
            setActiveRequests(requests);
            
            // 🆕 Check for status changes and send notifications
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const req = change.doc.data() as GuestRequest;
                    const prevStatus = previousStatuses.get(change.doc.id);
                    
                    // Only notify if status actually changed
                    if (prevStatus && prevStatus !== req.status) {
                        const { title, body } = getStatusMessage(req.status, req.serviceType);
                        if (title && body) {
                            sendGuestNotification(title, body);
                        }
                    }
                }
                
                // Update tracking
                const data = change.doc.data();
                if (change.type === 'removed') {
                    previousStatuses.delete(change.doc.id);
                } else {
                    previousStatuses.set(change.doc.id, data.status);
                }
            });
        });
    };

    // Listen for recently completed requests to show rating modal automatically
    const listenForCompletedRequests = (sessionData: GuestSession) => {
        // ✅ Use tenant-scoped collection
        const tenantId = sessionData.hotelId || 'default';
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const q = query(
            requestsRef,
            where('roomNumber', '==', sessionData.roomNumber),
            where('branch', '==', sessionData.branch),
            where('status', '==', 'COMPLETED')
        );

        return onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified' || change.type === 'added') {
                    const req = { id: change.doc.id, ...change.doc.data() } as GuestRequest;
                    
                    // 🆕 Send completion notification
                    if (change.type === 'modified') {
                        const { title, body } = getStatusMessage('COMPLETED', req.serviceType);
                        sendGuestNotification(title, body);
                    }
                    
                    // Show rating modal if request just completed and not rated
                    if (!req.rating && change.type === 'modified') {
                        setTimeout(() => openRatingModal(req), 2000);
                    }
                }
            });
        });
    };

    const loadRecentRequests = async (sessionData: GuestSession) => {
        try {
            // ✅ Use tenant-scoped collection
            const tenantId = sessionData.hotelId || 'default';
            const requestsRef = collection(db, `tenants/${tenantId}/requests`);
            const q = query(
                requestsRef,
                where('roomNumber', '==', sessionData.roomNumber),
                where('branch', '==', sessionData.branch),
                where('status', '==', 'COMPLETED')
            );
            const snapshot = await getDocs(q);
            const requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GuestRequest));
            setRecentRequests(requests.slice(0, 10));
        } catch (error) {
            console.error('Error loading recent requests:', error);
        }
    };

    const handleServiceClick = (service: ServiceItem) => {
        // Check if maintenance mode is enabled
        if (branchSettings?.system?.maintenanceMode) {
            showGuestToast('warning', 'عذراً، الخدمة متوقفة مؤقتاً للصيانة. يرجى المحاولة لاحقاً أو الاتصال بالاستقبال.');
            return;
        }

        // Check if department is open
        if (!isDepartmentOpen(service.type)) {
            showOutOfHoursModal(service.type);
            return;
        }

        if (service.type === 'room_service') {
            setShowCoffeeModal(true);
            return;
        }

        if (service.type === 'minibar') {
            setShowMinibarModal(true);
            return;
        }

        setSelectedService(service);
        setRequestNotes('');
        setRequestPhoto(null);
        setScheduleTime('');
        setShowRequestModal(true);
    };

    const handleQRServiceClick = (qrService: QRService) => {
        if (!session) return;

        // Check if maintenance mode is enabled
        if (branchSettings?.system?.maintenanceMode) {
            showGuestToast('warning', 'عذراً، الخدمة متوقفة مؤقتاً للصيانة. يرجى المحاولة لاحقاً أو الاتصال بالاستقبال.');
            return;
        }

        // Check time restrictions
        if (qrService.timeRestrictions?.enabled) {
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const start = qrService.timeRestrictions.startTime || '00:00';
            const end = qrService.timeRestrictions.endTime || '23:59';
            
            if (currentTime < start || currentTime > end) {
                // Show out of hours modal with emergency option
                showOutOfHoursModal(qrService.requestType || 'other');
                return;
            }
        }

        // Check department hours for the target department
        const deptKey = qrService.targetDepartment === 'coffee_shop' ? 'coffee' : 
                       qrService.targetDepartment === 'bellman' ? 'bellman' :
                       qrService.targetDepartment;
        
        if (!isDepartmentOpen(deptKey)) {
            showOutOfHoursModal(qrService.requestType || 'other');
            return;
        }

        // Open dynamic service form
        setSelectedQRService(qrService);
        setQRServiceFormData({});
        setShowQRServiceModal(true);
    };

    const handleQRServiceSubmit = async () => {
        if (!session || !selectedQRService) return;
        
        // ✅ Demo Mode Check - Block real requests in demo mode
        if (isDemoMode) {
            showGuestToast('warning', 'هذه نسخة تجريبية للعرض فقط - لا يمكن إرسال طلبات فعلية 🎭');
            return;
        }
        
        setIsSubmitting(true);
        try {
            // 🔐 RATE LIMIT CHECK - Budget Protection!
            const rateLimitResult = await checkRateLimit('request');
            if (!rateLimitResult.allowed) {
                haptic?.('error');
                alert(`⚠️ ${rateLimitResult.reason}\n\n${rateLimitResult.resetIn ? `حاول مرة أخرى بعد ${Math.ceil(rateLimitResult.resetIn / 60)} دقيقة` : ''}`);
                setIsSubmitting(false);
                return;
            }
            
            // Validate required fields
            for (const field of selectedQRService.fields || []) {
                if (field.required && !qrServiceFormData[field.key]) {
                    alert(`يرجى ملء حقل: ${field.label}`);
                    setIsSubmitting(false);
                    return;
                }
            }

            // Create request from QR service
            const requestId = await createRequestFromQRService(
                selectedQRService.id,
                session.roomNumber,
                session.guestName,
                session.guestIdentity,
                session.guestPhone,
                qrServiceFormData,
                session.branch,
                session.hotelId
            );

            // 🔐 Record the action for rate limiting
            await recordRateLimitedAction('request');
            
            alert('✅ تم إرسال الطلب بنجاح!');
            setShowQRServiceModal(false);
            setSelectedQRService(null);
            setQRServiceFormData({});
            await loadRecentRequests(session);
        } catch (error) {
            console.error('Error submitting QR service request:', error);
            alert('❌ فشل إرسال الطلب. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => setRequestPhoto(e.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const removePhoto = () => setRequestPhoto(null);

    // ✅ Rate Limiting - التحقق من عدد الطلبات
    const checkRateLimit = (): boolean => {
        const now = Date.now();
        // تنظيف الطلبات القديمة (أكثر من دقيقة)
        const recentRequests = requestTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
        setRequestTimestamps(recentRequests);
        
        if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
            const waitTime = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recentRequests[0])) / 1000);
            haptic?.('error');
            alert(`⏳ لقد أرسلت ${RATE_LIMIT_MAX_REQUESTS} طلبات خلال دقيقة واحدة.\n\nيرجى الانتظار ${waitTime} ثانية قبل إرسال طلب جديد.\n\nYou have sent ${RATE_LIMIT_MAX_REQUESTS} requests in one minute.\nPlease wait ${waitTime} seconds.`);
            return false;
        }
        return true;
    };
    
    // ✅ تسجيل طلب جديد في Rate Limiter
    const recordRequest = () => {
        setRequestTimestamps(prev => [...prev, Date.now()]);
    };

    const submitRequest = async () => {
        if (!session || !selectedService) return;
        
        // ✅ Demo Mode Check - Block real requests in demo mode
        if (isDemoMode) {
            showGuestToast('warning', 'هذه نسخة تجريبية للعرض فقط - لا يمكن إرسال طلبات فعلية 🎭');
            return;
        }
        
        // ✅ Rate Limit Check - منع الطلبات المتكررة
        if (!checkRateLimit()) {
            return;
        }
        
        // 🆕 Check if room is blocked due to failed verification attempts
        if (session.hotelId && session.branch) {
            const blockStatus = await checkRoomBlockStatus(session.hotelId, session.branch, session.roomNumber);
            if (blockStatus.isBlocked && blockStatus.blockedUntil) {
                triggerHaptic('error');
                setRoomBlockedUntil(blockStatus.blockedUntil);
                alert(`🚫 الغرفة محظورة مؤقتاً\n\nسبب: محاولات تحقق فاشلة\nالوقت المتبقي: ${blockStatus.remainingMinutes} دقيقة\n\nيرجى التواصل مع الاستقبال.`);
                return;
            }
        }
        
        setIsSubmitting(true);

        try {
            // ✅ Perform comprehensive check before submitting (Location + Device + Room Status)
            const checkResult = await performComprehensiveCheck(session.hotelId, session.branch, session.roomNumber);
            
            if (!checkResult.allowed) {
                // Set specific errors
                if (!checkResult.roomValid) {
                    setRoomStatusError(checkResult.errors.find(e => e.includes('دخول') || e.includes('QR') || e.includes('الغرفة')) || 'الغرفة غير متاحة');
                }
                if (!checkResult.deviceValid) {
                    setDeviceError(checkResult.errors.find(e => e.includes('جهاز') || e.includes('device')) || 'تم الوصول للحد الأقصى للأجهزة');
                }
                if (!checkResult.locationValid) {
                    setLocationError(checkResult.errors.find(e => e.includes('موقع') || e.includes('location') || e.includes('GPS')) || 'الموقع غير صحيح');
                }
                setIsSubmitting(false);
                return; // Block request if checks fail
            }
            
            // ✅ QR Request - Send to Reception first for confirmation
            const requestData: any = {
                type: selectedService.type,
                serviceType: selectedService.type,
                roomNumber: session.roomNumber,
                guestName: session.guestName || 'نزيل الغرفة', // ✅ Guest name (optional)
                guestIdentity: session.guestIdentity, // ✅ Identity/Phone for confirmation
                guestPhone: session.guestPhone, // ✅ Phone number
                branch: session.branch,
                tenantId: session.hotelId, // ✅ SaaS: Add tenantId
                status: 'PENDING_RECEPTION', // ✅ Send to Reception for confirmation first
                priority: 'normal',
                notes: requestNotes,
                createdAt: Timestamp.now(),
                source: 'QR' as const, // ✅ Mark as QR request
                // ✅ Request Journey Tracking
                currentDepartment: 'reception',
                originDepartment: 'reception',
                departmentHistory: [{
                    department: 'reception',
                    status: 'PENDING_RECEPTION',
                    enteredAt: Timestamp.now(),
                    handledBy: {
                        id: 'GUEST',
                        name: session.guestName || 'نزيل'
                    },
                    notes: 'طلب من QR - في انتظار تأكيد الاستقبال'
                }]
            };

            // ✅ Upload photo to ImgBB with compression (if exists)
            if (requestPhoto) {
                try {
                    const uploadResult = await uploadToImgBB(requestPhoto, `guest_request_${Date.now()}`, undefined, {
                        maxWidth: 1200,
                        maxHeight: 1200,
                        maxSizeKB: 300 // ✅ Enforce 300KB limit
                    });
                    
                    if (uploadResult.success && uploadResult.url) {
                        requestData.photo = uploadResult.url; // ✅ ImgBB URL (not base64!)
                        requestData.photoThumb = uploadResult.thumbUrl; // ✅ Thumbnail for faster loading
                    } else {
                        console.warn('Photo upload failed, sending without photo:', uploadResult.error);
                        // Don't block the request - just send without photo
                    }
                } catch (photoError) {
                    console.error('Photo upload error:', photoError);
                    // Don't block the request - just send without photo
                }
            }
            if (scheduleTime) requestData.scheduledFor = scheduleTime;

            // ✅ Use tenant-scoped collection
            const tenantId = session.hotelId || 'default';
            const requestsRef = collection(db, `tenants/${tenantId}/requests`);
            const docRef = await addDoc(requestsRef, requestData);
            
            // ✅ تسجيل الطلب في Rate Limiter
            recordRequest();

            await logGuestActivity('request_created', {
                type: selectedService.type,
                requestId: docRef.id
            });

            setShowRequestModal(false);
            setSelectedService(null);
            showRequestTracker(docRef.id, selectedService.type);
        } catch (error) {
            console.error('Error submitting request:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const showRequestTracker = (requestId: string, serviceType: string) => {
        // Simple tracker - just show the active request
        const request = activeRequests.find(r => r.id === requestId);
        if (request) setTrackedRequest(request);
    };

    const closeTracker = () => setTrackedRequest(null);

    // ============================================================
    // DO NOT DISTURB
    // ============================================================

    const toggleDoNotDisturb = async () => {
        if (!session) return;
        const newValue = !doNotDisturb;

        try {
            setDoNotDisturb(newValue);

            // Save DND status to roomCards for staff visibility
            const roomCardsRef = collection(db, 'roomCards');
            const q = query(
                roomCardsRef,
                where('roomNumber', '==', session.roomNumber),
                where('branch', '==', session.branch),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const roomCardDoc = snapshot.docs[0];
                await updateDoc(doc(db, 'roomCards', roomCardDoc.id), {
                    doNotDisturb: newValue,
                    dndUpdatedAt: Timestamp.now()
                });
            }

            await logGuestActivity('dnd_toggle', { enabled: newValue });
        } catch (error) {
            console.error('Error toggling DND:', error);
            // Revert on error
            setDoNotDisturb(!newValue);
        }
    };

    // ============================================================
    // RATING
    // ============================================================

    const openRatingModal = (request: GuestRequest) => {
        if (!request.rating) {
            setRatingRequest(request);
            setRatingValue(0);
        }
    };

    const closeRatingModal = () => {
        setRatingRequest(null);
        setRatingValue(0);
    };

    const selectRating = (value: number) => setRatingValue(value);

    const submitRating = async () => {
        if (!ratingRequest || !ratingValue) return;
        try {
            await updateDoc(doc(db, 'requests', ratingRequest.id), {
                rating: ratingValue,
                ratedAt: Timestamp.now()
            });
            await logGuestActivity('request_rated', {
                requestId: ratingRequest.id,
                rating: ratingValue
            });
            closeRatingModal();
        } catch (error) {
            console.error('Error submitting rating:', error);
        }
    };

    // ============================================================
    // DYNAMIC RATING SYSTEM
    // ============================================================

    const handleDynamicRatingChange = (questionId: string, value: any) => {
        setRatingResponses({
            ...ratingResponses,
            [questionId]: value
        });
    };

    const handleSubmitDynamicRating = async () => {
        if (!ratingInvitation || !ratingInvitation.template) return;

        const template = ratingInvitation.template as RatingTemplate;

        // Validate required questions
        if (template.requireAllQuestions) {
            const allRequired = template.questions.filter(q => q.required).every(q => ratingResponses[q.id]);
            if (!allRequired) {
                alert('يرجى الإجابة على جميع الأسئلة المطلوبة');
                return;
            }
        } else {
            // At least first question must be answered
            const firstQuestion = template.questions[0];
            if (firstQuestion.required && !ratingResponses[firstQuestion.id]) {
                alert('يرجى الإجابة على السؤال الأول على الأقل');
                return;
            }
        }

        setRatingSubmitting(true);
        try {
            const overallRating = ratingResponses[template.questions[0]?.id] || null;
            const feedback = ratingResponses['feedback'] || null;

            await submitRatingResponse(
                ratingInvitation.id,
                ratingResponses,
                overallRating,
                feedback
            );

            alert('شكراً لك! تم إرسال تقييمك بنجاح.');
            setShowRatingModal(false);
            setRatingInvitation(null);
            setRatingResponses({});
        } catch (error) {
            console.error('Error submitting dynamic rating:', error);
            alert('حدث خطأ أثناء إرسال التقييم. يرجى المحاولة مرة أخرى.');
        } finally {
            setRatingSubmitting(false);
        }
    };

    const handleDismissRating = async () => {
        if (!ratingInvitation) return;
        await dismissRatingInvitation(ratingInvitation.id);
        setShowRatingModal(false);
        setRatingInvitation(null);
        setRatingResponses({});
    };

    // ============================================================
    // ANNOUNCEMENTS HANDLERS
    // ============================================================

    const handleAnnouncementRead = async (announcementId: string) => {
        if (!session) return;
        
        try {
            await markAnnouncementAsRead(
                announcementId,
                session.roomNumber,
                session.branch,
                session.hotelId,
                session.guestName
            );
            
            // Update local read status
            const statuses = await getAnnouncementReadStatus(session.roomNumber, session.branch, session.hotelId);
            setAnnouncementReadStatuses(statuses);
            
            // Recalculate unread count
            const visibleAnnouncements = getVisibleAnnouncements(announcements, statuses);
            const unreadCountValue = getUnreadAnnouncementsCount(announcements, statuses);
            setUnreadCount(unreadCountValue);
        } catch (error) {
            console.error('Error marking announcement as read:', error);
        }
    };

    const handleOpenAnnouncements = () => {
        setShowAnnouncementsModal(true);
    };

    // ============================================================
    // EMERGENCY ALERTS HANDLERS
    // ============================================================

    const handleEmergencyAlertRead = async (alertId: string) => {
        if (!session) return;
        
        try {
            await markAlertAsRead(
                alertId,
                session.roomNumber,
                session.branch,
                session.hotelId,
                session.guestName
            );
            
            // Update local read status
            const statuses = await getAlertReadStatus(session.roomNumber, session.branch, session.hotelId);
            setAlertReadStatuses(statuses);
        } catch (error) {
            console.error('Error marking alert as read:', error);
        }
    };

    const handleDismissEmergencyAlert = async (alertId: string) => {
        if (!session) return;
        
        try {
            await dismissAlert(alertId, session.roomNumber, session.branch, session.hotelId);
            setShowEmergencyAlertModal(false);
            setCurrentEmergencyAlert(null);
            
            // Update local read status
            const statuses = await getAlertReadStatus(session.roomNumber, session.branch, session.hotelId);
            setAlertReadStatuses(statuses);
        } catch (error) {
            console.error('Error dismissing alert:', error);
        }
    };

    // Check for unread emergency alerts on page load
    useEffect(() => {
        if (!session || emergencyAlerts.length === 0) return;

        // Find unread critical/high alerts
        const unreadCritical = emergencyAlerts.find(alert => {
            const readStatus = alertReadStatuses[alert.id];
            return !readStatus && (alert.severity === 'critical' || alert.severity === 'high') && alert.autoShow;
        });

        if (unreadCritical) {
            setCurrentEmergencyAlert(unreadCritical);
            setShowEmergencyAlertModal(true);
        }
    }, [session, emergencyAlerts, alertReadStatuses]);

    // ============================================================
    // PRODUCT MENUS
    // ============================================================

    const loadCoffeeMenu = async (sessionData: GuestSession) => {
        try {
            // ✅ FIX: Use 'tenants' collection instead of 'hotels' for SaaS data isolation
            const menuRef = collection(db, `tenants/${sessionData.hotelId}/branches/${sessionData.branch}/coffee_menu`);
            const snapshot = await getDocs(menuRef);
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
            setCoffeeMenu(items.length > 0 ? items : [
                { id: 'latte', name: 'لاتيه', price: 18, icon: '☕' },
                { id: 'cappuccino', name: 'كابتشينو', price: 16, icon: '☕' },
                { id: 'americano', name: 'أمريكانو', price: 14, icon: '☕' },
                { id: 'tea', name: 'شاي', price: 10, icon: '🍵' }
            ]);
        } catch (error) {
            console.error('Error loading coffee menu:', error);
        }
    };

    // ============================================================
    // DYNAMIC QR SERVICES SUBSCRIPTION
    // ============================================================
    
    // Subscribe to dynamic QR services with real-time updates
    useEffect(() => {
        if (!session) return;

        const branchId = session.branch;
        const tenantId = session.hotelId;

        if (!branchId || !tenantId) return;

        console.log('🔄 Subscribing to dynamic QR services...', { branchId, tenantId });

        // Subscribe to real-time updates
        const unsubscribe = subscribeToQRServices(branchId, tenantId, (services) => {
            console.log('📱 Dynamic QR services updated:', services.length, 'services');
            setDynamicServices(services);
        });

        // Cleanup on unmount or when session changes
        return () => {
            console.log('🔌 Unsubscribing from dynamic QR services');
            unsubscribe();
        };
    }, [session?.branch, session?.hotelId]);

    // Subscribe to rating invitations with real-time updates
    useEffect(() => {
        if (!session) return;

        const branchId = session.branch;
        const tenantId = session.hotelId;
        const roomNumber = session.roomNumber;

        if (!branchId || !tenantId || !roomNumber) return;

        console.log('⭐ Subscribing to rating invitations...', { roomNumber, branchId, tenantId });

        // Subscribe to real-time updates
        const unsubscribe = subscribeToRatingInvitations(roomNumber, branchId, tenantId, (invitations) => {
            console.log('⭐ Rating invitations updated:', invitations.length, 'invitations');
            
            // Show first pending invitation
            const pendingInvitation = invitations.find(inv => inv.status === 'pending');
            if (pendingInvitation && pendingInvitation.template) {
                // Check if auto-show is enabled
                if (pendingInvitation.template.autoShow) {
                    const delay = (pendingInvitation.template.delaySeconds || 0) * 1000;
                    setTimeout(() => {
                        setRatingInvitation(pendingInvitation);
                        setShowRatingModal(true);
                        markInvitationAsShown(pendingInvitation.id);
                    }, delay);
                } else {
                    // Store for manual trigger
                    setRatingInvitation(pendingInvitation);
                }
            }
        });

        // Cleanup on unmount or when session changes
        return () => {
            console.log('🔌 Unsubscribing from rating invitations');
            unsubscribe();
        };
    }, [session?.branch, session?.hotelId, session?.roomNumber]);

    // Subscribe to announcements with real-time updates
    useEffect(() => {
        if (!session) return;

        const branchId = session.branch;
        const tenantId = session.hotelId;
        const roomNumber = session.roomNumber;

        if (!branchId || !tenantId || !roomNumber) return;

        console.log('🔔 Subscribing to announcements...', { roomNumber, branchId, tenantId });

        // Load read statuses
        const loadReadStatuses = async () => {
            try {
                const statuses = await getAnnouncementReadStatus(roomNumber, branchId, tenantId);
                setAnnouncementReadStatuses(statuses);
            } catch (error) {
                console.error('Error loading announcement read statuses:', error);
            }
        };

        loadReadStatuses();

        // Subscribe to real-time announcements
        const unsubscribe = subscribeToAnnouncements(branchId, tenantId, async (announcementsList) => {
            console.log('🔔 Announcements updated:', announcementsList.length, 'announcements');
            setAnnouncements(announcementsList);
            
            // Update read statuses and unread count
            const statuses = await getAnnouncementReadStatus(roomNumber, branchId, tenantId);
            setAnnouncementReadStatuses(statuses);
            
            const visibleAnnouncements = getVisibleAnnouncements(announcementsList, statuses);
            const unreadCountValue = getUnreadAnnouncementsCount(announcementsList, statuses);
            setUnreadCount(unreadCountValue);
        });

        // Cleanup on unmount or when session changes
        return () => {
            console.log('🔌 Unsubscribing from announcements');
            unsubscribe();
        };
    }, [session?.branch, session?.hotelId, session?.roomNumber]);

    // Request notification permission on mount
    useEffect(() => {
        if ('Notification' in window) {
            setNotificationPermission(Notification.permission);
            if (Notification.permission === 'default') {
                requestNotificationPermission().then(granted => {
                    if (granted) {
                        setNotificationPermission('granted');
                    }
                });
            }
        }
    }, []);

    // Subscribe to emergency alerts with real-time updates
    useEffect(() => {
        if (!session) return;

        const branchId = session.branch;
        const tenantId = session.hotelId;
        const roomNumber = session.roomNumber;

        if (!branchId || !tenantId || !roomNumber) return;

        console.log('🚨 Subscribing to emergency alerts...', { roomNumber, branchId, tenantId });

        // Load read statuses
        const loadReadStatuses = async () => {
            try {
                const statuses = await getAlertReadStatus(roomNumber, branchId, tenantId);
                setAlertReadStatuses(statuses);
            } catch (error) {
                console.error('Error loading alert read statuses:', error);
            }
        };

        loadReadStatuses();

        // Subscribe to real-time emergency alerts
        const unsubscribe = subscribeToEmergencyAlerts(roomNumber, branchId, tenantId, async (alerts) => {
            console.log('🚨 Emergency alerts updated:', alerts.length, 'alerts');
            
            // Check for new alerts
            const currentAlertIds = alerts.map(a => a.id);
            const newAlerts = alerts.filter(a => !previousAlertIdsRef.current.includes(a.id));
            
            if (newAlerts.length > 0) {
                // New alert received!
                const latestAlert = newAlerts[0]; // Most critical/newest
                
                // Play sound if enabled
                if (latestAlert.showSound) {
                    playAlertSound(latestAlert.soundType || 'alert');
                }
                
                // Show browser notification if enabled and permission granted
                if (latestAlert.showNotification && notificationPermission === 'granted') {
                    showBrowserNotification(
                        latestAlert.titleAr || latestAlert.title,
                        {
                            body: latestAlert.messageAr || latestAlert.message,
                            tag: `emergency-${latestAlert.id}`,
                            requireInteraction: latestAlert.severity === 'critical',
                        } as any
                    );
                }
                
                // Auto-show if enabled
                if (latestAlert.autoShow) {
                    setCurrentEmergencyAlert(latestAlert);
                    setShowEmergencyAlertModal(true);
                    await markAlertAsRead(latestAlert.id, roomNumber, branchId, tenantId, session.guestName);
                }
            }
            
            setEmergencyAlerts(alerts);
            previousAlertIdsRef.current = currentAlertIds;
            
            // Update read statuses
            const statuses = await getAlertReadStatus(roomNumber, branchId, tenantId);
            setAlertReadStatuses(statuses);
        });

        // Cleanup on unmount or when session changes
        return () => {
            console.log('🔌 Unsubscribing from emergency alerts');
            unsubscribe();
        };
    }, [session?.branch, session?.hotelId, session?.roomNumber, notificationPermission]);

    // ============================================================
    // ✅ ROOM TRANSFER LISTENER
    // ============================================================
    useEffect(() => {
        if (!session?.roomNumber || !session?.branch || !session?.hotelId) return;

        const tenantId = session.hotelId;
        const branchId = session.branch;
        const currentRoom = session.roomNumber;

        console.log('🚚 Setting up room transfer listener for room:', currentRoom);

        const unsubscribe = subscribeToRoomTransfers(
            tenantId,
            branchId,
            currentRoom,
            (notification) => {
                console.log('🚚 Room transfer detected:', notification);
                
                // Show the transfer notification
                setRoomTransferNotification(notification);
                
                // Haptic feedback
                haptic('warning');
                playSound('notification');
                
                // Update the session with the new room after a short delay for UX
                setTimeout(() => {
                    setSession(prev => prev ? {
                        ...prev,
                        roomNumber: notification.newRoom
                    } : null);
                    
                    // Also update resolved room
                    setResolvedRoom(notification.newRoom);
                    
                    // Update URL with new room (without reload)
                    const url = new URL(window.location.href);
                    url.searchParams.set('room', notification.newRoom);
                    window.history.replaceState({}, '', url.toString());
                    
                    // Auto-hide the notification after 5 seconds
                    setTimeout(() => {
                        setRoomTransferNotification(null);
                    }, 5000);
                }, 1000);
            }
        );

        return () => {
            console.log('🔌 Unsubscribing from room transfer listener');
            unsubscribe();
        };
    }, [session?.roomNumber, session?.branch, session?.hotelId]);

    const loadMinibarMenu = async (sessionData: GuestSession) => {
        try {
            // ✅ FIX: Use 'tenants' collection instead of 'hotels' for SaaS data isolation
            const menuRef = collection(db, `tenants/${sessionData.hotelId}/branches/${sessionData.branch}/minibar`);
            const snapshot = await getDocs(menuRef);
            const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
            setMinibarMenu(items.length > 0 ? items : [
                { id: 'water', name: 'ماء', price: 5, icon: '💧' },
                { id: 'cola', name: 'كولا', price: 8, icon: '🥤' },
                { id: 'juice', name: 'عصير', price: 10, icon: '🧃' },
                { id: 'snack', name: 'سناك', price: 12, icon: '🍫' }
            ]);
        } catch (error) {
            console.error('Error loading minibar menu:', error);
        }
    };

    const updateProductQty = (type: 'coffee' | 'minibar', productId: string, delta: number) => {
        const setCart = type === 'coffee' ? setCoffeeCart : setMinibarCart;
        const cart = type === 'coffee' ? coffeeCart : minibarCart;

        const current = cart[productId] || 0;
        const newValue = Math.max(0, current + delta);

        setCart({ ...cart, [productId]: newValue });
    };

    const getCartTotal = (type: 'coffee' | 'minibar'): number => {
        const cart = type === 'coffee' ? coffeeCart : minibarCart;
        const menu = type === 'coffee' ? coffeeMenu : minibarMenu;

        return Object.entries(cart).reduce((total, [id, qty]) => {
            const item = menu.find(m => m.id === id);
            return total + (item?.price || 0) * qty;
        }, 0);
    };

    const submitProductOrder = async (type: 'coffee' | 'minibar') => {
        if (!session) return;
        
        // ✅ Demo Mode Check - Block real requests in demo mode
        if (isDemoMode) {
            showGuestToast('warning', 'هذه نسخة تجريبية للعرض فقط - لا يمكن إرسال طلبات فعلية 🎭');
            return;
        }
        
        setIsSubmitting(true);

        try {
            // ✅ Perform comprehensive check before submitting (Location + Device + Room Status)
            const checkResult = await performComprehensiveCheck(session.hotelId, session.branch, session.roomNumber);
            
            if (!checkResult.allowed) {
                // Set specific errors
                if (!checkResult.roomValid) {
                    setRoomStatusError(checkResult.errors.find(e => e.includes('دخول') || e.includes('QR') || e.includes('الغرفة')) || 'الغرفة غير متاحة');
                }
                if (!checkResult.deviceValid) {
                    setDeviceError(checkResult.errors.find(e => e.includes('جهاز') || e.includes('device')) || 'تم الوصول للحد الأقصى للأجهزة');
                }
                if (!checkResult.locationValid) {
                    setLocationError(checkResult.errors.find(e => e.includes('موقع') || e.includes('location') || e.includes('GPS')) || 'الموقع غير صحيح');
                }
                setIsSubmitting(false);
                return; // Block order if checks fail
            }
            
            const cart = type === 'coffee' ? coffeeCart : minibarCart;
            const menu = type === 'coffee' ? coffeeMenu : minibarMenu;

            const items = Object.entries(cart)
                .filter(([_, qty]) => qty > 0)
                .map(([id, qty]) => {
                    const item = menu.find(m => m.id === id);
                    return { id, name: item?.name, qty, price: item?.price };
                });

            // ✅ Use tenant-scoped collection
            const tenantId = session.hotelId || 'default';
            const requestsRef = collection(db, `tenants/${tenantId}/requests`);
            await addDoc(requestsRef, {
                type: type === 'coffee' ? 'room_service' : 'minibar',
                serviceType: type === 'coffee' ? 'room_service' : 'minibar',
                roomNumber: session.roomNumber,
                guestName: session.guestName || 'نزيل الغرفة', // ✅ Guest name
                guestIdentity: session.guestIdentity, // ✅ Identity/Phone
                guestPhone: session.guestPhone, // ✅ Phone number
                branch: session.branch,
                tenantId: tenantId, // ✅ SaaS: Add tenantId
                status: 'PENDING_RECEPTION', // ✅ Send to Reception for confirmation
                priority: 'normal',
                items,
                total: getCartTotal(type),
                createdAt: Timestamp.now(),
                source: 'QR' as const, // ✅ Mark as QR request
                // ✅ Request Journey Tracking
                currentDepartment: 'reception',
                originDepartment: 'reception',
                departmentHistory: [{
                    department: 'reception',
                    status: 'PENDING_RECEPTION',
                    enteredAt: Timestamp.now(),
                    handledBy: {
                        id: 'GUEST',
                        name: session.guestName || 'نزيل'
                    },
                    notes: 'طلب من QR - في انتظار تأكيد الاستقبال'
                }]
            });

            await logGuestActivity('order_placed', { type, items, total: getCartTotal(type) });

            if (type === 'coffee') {
                setCoffeeCart({});
                setShowCoffeeModal(false);
            } else {
                setMinibarCart({});
                setShowMinibarModal(false);
            }
        } catch (error) {
            console.error('Error submitting order:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ============================================================
    // QUICK ACTIONS
    // ============================================================

    const callReception = () => {
        const phone = branchSettings?.receptionPhone || '+966500000000';
        window.location.href = `tel:${phone}`;
    };

    const openWhatsApp = () => {
        const number = branchSettings?.whatsappNumber || '966500000000';
        const message = encodeURIComponent(`مرحباً، أنا نزيل في الغرفة ${session?.roomNumber}، أود الاستفسار عن...`);
        window.open(`https://wa.me/${number}?text=${message}`, '_blank');
    };

    const requestExtension = async () => {
        if (!session) return;

        if (!confirm('سوف يتم إرسال طلب تمديد الإقامة للاستقبال لبحث الإمكانية.\n\nهل تريد المتابعة؟')) {
            return;
        }

        try {
            // ✅ Perform comprehensive check before submitting (Location + Device + Room Status)
            const checkResult = await performComprehensiveCheck(session.hotelId, session.branch, session.roomNumber);
            
            if (!checkResult.allowed) {
                // Set specific errors
                if (!checkResult.roomValid) {
                    setRoomStatusError(checkResult.errors.find(e => e.includes('دخول') || e.includes('QR') || e.includes('الغرفة')) || 'الغرفة غير متاحة');
                }
                if (!checkResult.deviceValid) {
                    setDeviceError(checkResult.errors.find(e => e.includes('جهاز') || e.includes('device')) || 'تم الوصول للحد الأقصى للأجهزة');
                }
                if (!checkResult.locationValid) {
                    setLocationError(checkResult.errors.find(e => e.includes('موقع') || e.includes('location') || e.includes('GPS')) || 'الموقع غير صحيح');
                }
                return; // Block request if checks fail
            }
            
            // ✅ Use tenant-scoped collection
            const tenantId = session.hotelId || 'default';
            const requestsRef = collection(db, `tenants/${tenantId}/requests`);
            await addDoc(requestsRef, {
                type: 'extension',
                serviceType: 'extension',
                roomNumber: session.roomNumber,
                guestName: session.guestName || 'نزيل الغرفة', // ✅ Guest name
                guestIdentity: session.guestIdentity, // ✅ Identity/Phone
                guestPhone: session.guestPhone, // ✅ Phone number
                branch: session.branch,
                tenantId: tenantId, // ✅ SaaS: Add tenantId
                status: 'PENDING_RECEPTION', // ✅ Send to Reception for confirmation
                priority: 'normal',
                notes: 'طلب تمديد الإقامة من النزيل',
                createdAt: Timestamp.now(),
                source: 'QR' as const, // ✅ Mark as QR request
                // ✅ Request Journey Tracking
                currentDepartment: 'reception',
                originDepartment: 'reception',
                departmentHistory: [{
                    department: 'reception',
                    status: 'PENDING_RECEPTION',
                    enteredAt: Timestamp.now(),
                    handledBy: {
                        id: 'GUEST',
                        name: session.guestName || 'نزيل'
                    },
                    notes: 'طلب من QR - في انتظار تأكيد الاستقبال'
                }]
            });

            await logGuestActivity('extension_request', {});
            alert('تم إرسال طلب التمديد بنجاح! سيتم التواصل معك.');
        } catch (error) {
            console.error('Extension error:', error);
            alert('فشل إرسال الطلب');
        }
    };

    const quickFeedback = async (requestId: string, isPositive: boolean) => {
        await logGuestActivity('quick_feedback', { requestId, isPositive });
    };

    // ============================================================
    // TAB SWITCHING
    // ============================================================

    const switchTab = (tabName: 'services' | 'history' | 'extras') => {
        setCurrentTab(tabName);
    };

    // ============================================================
    // UTILITIES
    // ============================================================

    const formatTime = (timestamp: any): string => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusLabel = (status: string): string => {
        switch (status) {
            case 'PENDING': return 'قيد الإنتظار';
            case 'CONFIRMED': return 'مؤكد';
            case 'IN_PROGRESS': return 'قيد التنفيذ';
            case 'COMPLETED': return 'مكتمل';
            default: return status;
        }
    };

    // ============================================================
    // LOADING STATE
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
                <img
                    src="/adora-logo.png"
                    alt="Adora"
                    className="w-32 h-32 object-contain mb-6 animate-pulse"
                    style={{ filter: 'drop-shadow(0 0 20px rgba(45, 212, 191, 0.4))' }}
                />
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-3 h-3 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        );
    }

    // ============================================================
    // VERIFICATION SCREEN - PREMIUM ADORA DESIGN (Matching Login)
    // ============================================================

    if (!session) {
        const room = extractRoomFromURL();
        
        // Dynamic greeting based on time of day (same as login)
        const getGreeting = () => {
            const hour = new Date().getHours();
            if (hour >= 5 && hour < 12) {
                return { text: 'صباح الخير', icon: 'sunrise', color: 'text-amber-500' };
            } else if (hour >= 12 && hour < 17) {
                return { text: 'مساء النور', icon: 'cloudsun', color: 'text-yellow-500' };
            } else if (hour >= 17 && hour < 21) {
                return { text: 'مساء الخير', icon: 'sunset', color: 'text-orange-500' };
            } else {
                return { text: 'مساء النجوم', icon: 'stars', color: 'text-indigo-400' };
            }
        };
        
        const greeting = getGreeting();
        
        // Greeting Icon Component
        const GreetingIcon = () => {
            const iconClass = `w-6 h-6 sm:w-8 sm:h-8 ${isDark ? 'text-amber-400' : greeting.color}`;
            switch(greeting.icon) {
                case 'sunrise': return <Sunrise className={iconClass} />;
                case 'cloudsun': return <CloudSun className={iconClass} />;
                case 'sunset': return <Sunset className={iconClass} />;
                case 'stars': return <Stars className={iconClass} />;
                default: return <Sun className={iconClass} />;
            }
        };
        
        return (
            <>
                {/* 🌓 Theme Toggle Button - Minimal Professional (Same as LoginScreen) */}
                <button
                    onClick={() => toggleTheme()}
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
                    aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
                >
                    {isDark ? (
                        <Sun className="w-5 h-5" />
                    ) : (
                        <Moon className="w-5 h-5" />
                    )}
                </button>
                
                <div 
                    className="min-h-screen flex flex-col relative overflow-hidden transition-all duration-[1500ms]"
                    style={{ minHeight: '100dvh' }}
                >
                {/* ✅ Main Content Wrapper - Centered */}
                <div className="flex-1 flex items-center justify-center p-4">
                    {/* ============================================
                        PREMIUM ANIMATED BACKGROUND - THEME AWARE
                        ============================================ */}
                    
                    {/* ☀️ LIGHT MODE Background */}
                    <div className={`absolute inset-0 premium-guest-bg transition-all duration-[1500ms] ${isDark ? 'opacity-0' : 'opacity-100'}`}>
                        {/* Base gradient - Richer colors */}
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50" />
                        
                        {/* Animated aurora gradient */}
                        <div className="absolute inset-0 guest-aurora-gradient" />
                        
                        {/* Wave decoration at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-64 guest-wave-bg" />
                        
                        {/* Large floating orbs with stronger colors */}
                        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] guest-orb guest-orb-1" />
                        <div className="absolute -bottom-32 -right-32 w-[450px] h-[450px] guest-orb guest-orb-2" />
                        <div className="absolute top-1/3 right-0 w-[350px] h-[350px] guest-orb guest-orb-3" />
                        
                        {/* Hexagon pattern */}
                        <div className="absolute inset-0 guest-hex-pattern" />
                        
                        {/* Animated lines */}
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="guest-line guest-line-1" />
                            <div className="guest-line guest-line-2" />
                            <div className="guest-line guest-line-3" />
                        </div>
                        
                        {/* Floating shapes */}
                        <div className="guest-shape guest-shape-1">◆</div>
                        <div className="guest-shape guest-shape-2">○</div>
                        <div className="guest-shape guest-shape-3">◇</div>
                        <div className="guest-shape guest-shape-4">●</div>
                        <div className="guest-shape guest-shape-5">△</div>
                        
                        {/* Glowing accent spots */}
                        <div className="absolute top-10 right-10 w-48 h-48 bg-gradient-to-br from-teal-400/30 to-cyan-400/20 rounded-full blur-3xl guest-glow-pulse" />
                        <div className="absolute bottom-20 left-10 w-56 h-56 bg-gradient-to-br from-emerald-400/25 to-teal-400/15 rounded-full blur-3xl guest-glow-pulse-delay" />
                        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-orange-400/10 rounded-full blur-2xl animate-pulse" />
                        
                        {/* Corner decorations */}
                        <div className="absolute top-0 left-0 w-64 h-64 guest-corner-decoration guest-corner-tl" />
                        <div className="absolute bottom-0 right-0 w-64 h-64 guest-corner-decoration guest-corner-br" />
                    </div>
                    
                    {/* 🌙 DARK MODE Background - Night Sky */}
                    <div className={`absolute inset-0 transition-all duration-[1500ms] ${isDark ? 'opacity-100' : 'opacity-0'}`}>
                        {/* Deep night sky gradient */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
                        
                        {/* Sunset glow at horizon */}
                        <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-orange-900/20 via-purple-900/10 to-transparent" />
                        
                        {/* Aurora borealis effect */}
                        <div className="absolute inset-0 overflow-hidden">
                            <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                            <div className="absolute top-20 right-1/4 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/10 via-indigo-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                        </div>
                        
                        {/* Twinkling stars */}
                        <div className="absolute inset-0">
                            {[...Array(50)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full bg-white"
                                    style={{
                                        width: `${Math.random() * 3 + 1}px`,
                                        height: `${Math.random() * 3 + 1}px`,
                                        top: `${Math.random() * 70}%`,
                                        left: `${Math.random() * 100}%`,
                                        animation: `twinkle ${Math.random() * 2 + 2}s ease-in-out infinite`,
                                        animationDelay: `${Math.random() * 3}s`,
                                        opacity: Math.random() * 0.7 + 0.3
                                    }}
                                />
                            ))}
                        </div>
                        
                        {/* Shooting star occasional */}
                        <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-white rounded-full animate-shooting-star" />
                        
                        {/* Subtle clouds/mist at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-900/50 to-transparent" />
                    </div>
                    
                    {/* Glowing accent - Theme aware */}
                    <div className={`absolute top-10 right-10 w-48 h-48 rounded-full blur-3xl guest-glow-pulse transition-all duration-[1500ms] ${
                        isDark 
                            ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10' 
                            : 'bg-gradient-to-br from-teal-400/30 to-cyan-400/20'
                    }`} />

                <div className="w-full max-w-sm relative z-10 guest-verify-container">
                    {/* ============================================
                        LOGO & DYNAMIC GREETING - PREMIUM ANIMATION
                        ============================================ */}
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
                            
                            {/* 🪐 Orbital Rings with Planets */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                {/* Orbit 1 - Closest */}
                                <div 
                                    className="absolute rounded-full guest-orbit-1"
                                    style={{ 
                                        width: '75%', 
                                        height: '75%',
                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(20, 184, 166, 0.12)'}`,
                                    }}
                                >
                                    <div 
                                        className={`absolute w-1.5 h-1.5 rounded-full ${isDark ? 'bg-amber-400/60' : 'bg-teal-400/60'}`}
                                        style={{ top: '0%', left: '50%', transform: 'translate(-50%, -50%)' }}
                                    />
                                </div>
                                
                                {/* Orbit 2 - Middle */}
                                <div 
                                    className="absolute rounded-full guest-orbit-2"
                                    style={{ 
                                        width: '90%', 
                                        height: '90%',
                                        border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(20, 184, 166, 0.08)'}`,
                                    }}
                                >
                                    <div 
                                        className={`absolute w-2 h-2 rounded-full ${isDark ? 'bg-cyan-400/50' : 'bg-cyan-500/50'}`}
                                        style={{ top: '50%', right: '0%', transform: 'translate(50%, -50%)' }}
                                    />
                                </div>
                                
                                {/* Orbit 3 - Outer */}
                                <div 
                                    className="absolute rounded-full guest-orbit-3"
                                    style={{ 
                                        width: '105%', 
                                        height: '105%',
                                        border: `1px dashed ${isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(20, 184, 166, 0.06)'}`,
                                    }}
                                >
                                    <div 
                                        className={`absolute w-1 h-1 rounded-full ${isDark ? 'bg-purple-400/40' : 'bg-emerald-400/40'}`}
                                        style={{ bottom: '0%', left: '50%', transform: 'translate(-50%, 50%)' }}
                                    />
                                </div>
                            </div>
                            
                            {/* Main Logo */}
                            <div className="relative z-10">
                                <img
                                    src="/adora-logo.png"
                                    alt="Adora - منظومة إدارة الفنادق"
                                    className="guest-logo-float guest-logo-crisp"
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
                            <div className={`absolute -top-1 right-2 w-2.5 h-2.5 sm:w-4 sm:h-4 rounded-full guest-sparkle ${isDark ? 'bg-amber-300' : 'bg-yellow-400'}`} />
                            <div className={`absolute top-1/4 -left-1 w-2 h-2 sm:w-3 sm:h-3 rounded-full guest-sparkle-delay ${isDark ? 'bg-orange-300' : 'bg-cyan-400'}`} />
                            <div className={`absolute -bottom-1 right-1/4 w-2 h-2 sm:w-3 sm:h-3 rounded-full guest-sparkle-delay-2 ${isDark ? 'bg-yellow-200' : 'bg-teal-300'}`} />
                        </div>

                        {/* Dynamic Welcome Message - Compact & Theme-aware */}
                        <div className="space-y-1 sm:space-y-2 guest-fade-up">
                            <p className={`flex items-center justify-center gap-3 text-lg sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-teal-800'}`}>
                                <GreetingIcon />
                                <span className={`bg-clip-text text-transparent ${isDark ? 'bg-gradient-to-r from-teal-300 to-cyan-300' : 'bg-gradient-to-r from-teal-700 to-teal-500'}`}>
                                    {greeting.text}
                                </span>
                            </p>
                            {/* Room Badge - Premium Style */}
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gradient-to-r from-teal-500 to-teal-600 shadow-lg shadow-teal-500/30">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-white font-bold text-base sm:text-lg">غرفة {room || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* ============================================
                        AUTH ERROR MESSAGE - ELEGANT & CLEAR
                        ============================================ */}
                    {authError && (
                        <div className={`w-full max-w-sm mb-6 rounded-2xl p-6 shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-top-2 ${
                            isDark 
                                ? 'bg-gradient-to-br from-amber-900/30 to-orange-900/20 border-2 border-amber-700/50 shadow-amber-900/30' 
                                : 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 shadow-amber-200/50'
                        }`}>
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    isDark 
                                        ? 'bg-amber-500/20 border border-amber-500/30' 
                                        : 'bg-amber-100 border border-amber-200'
                                }`}>
                                    <AlertCircle className={`w-6 h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                                        {authError.includes('مرحباً بك') ? 'مرحباً بك في فندق أدورا 🌟' : 'تنبيه مهم'}
                                    </h3>
                                    <p className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-amber-100/90' : 'text-amber-700'}`}>
                                        {authError}
                                    </p>
                                    {authError.includes('التواصل مع الاستقبال') && (
                                        <div className="mt-4 pt-4 border-t border-amber-500/20">
                                            <p className={`text-xs ${isDark ? 'text-amber-200/70' : 'text-amber-600/80'}`}>
                                                💡 نصيحة: يمكنك التواصل مع الاستقبال عبر رقم الواتساب الموجود في صفحة الخدمات
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setAuthError(null)}
                                    className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                                        isDark 
                                            ? 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10' 
                                            : 'text-amber-600/60 hover:text-amber-600 hover:bg-amber-100'
                                    }`}
                                    aria-label="إغلاق"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ============================================
                        MAIN VERIFICATION CARD - THEME AWARE
                        ============================================ */}
                    <div className={`rounded-3xl p-5 sm:p-6 shadow-2xl transition-all duration-500 ${
                        isDark 
                            ? 'bg-slate-800/95 border-slate-700 shadow-slate-900/30' 
                            : 'bg-white border-teal-100 shadow-teal-900/10'
                    } border`}>
                        {!verifyType ? (
                            <div className="space-y-4">
                                {/* Title */}
                                <p className={`text-center mb-4 font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>اختر طريقة التحقق</p>
                                
                                {/* Identity Verification Button */}
                                <button
                                    onClick={() => showVerifyInput('identity')}
                                    className={`w-full rounded-xl p-4 sm:p-5 flex items-center justify-between transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] group border-2 ${
                                        isDark 
                                            ? 'bg-slate-700/50 hover:bg-slate-700 border-slate-600 hover:border-teal-500' 
                                            : 'bg-white hover:bg-teal-50/50 border-teal-200 hover:border-teal-400 shadow-lg shadow-teal-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform ${
                                            isDark ? 'shadow-lg shadow-teal-500/40' : 'shadow-xl shadow-teal-400/60 ring-4 ring-teal-100'
                                        }`}>
                                            <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-bold block text-base sm:text-lg ${isDark ? 'text-white' : 'text-slate-700'}`}>التحقق بالهوية</span>
                                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>آخر 4 أرقام من الهوية أو جواز السفر</span>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 group-hover:text-teal-500 group-hover:translate-x-1 transition-all ${isDark ? 'text-slate-500' : 'text-teal-400'}`} />
                                </button>
                                
                                {/* Phone Verification Button */}
                                <button
                                    onClick={() => showVerifyInput('phone')}
                                    className={`w-full rounded-xl p-4 sm:p-5 flex items-center justify-between transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] group border-2 ${
                                        isDark 
                                            ? 'bg-slate-700/50 hover:bg-slate-700 border-slate-600 hover:border-cyan-500' 
                                            : 'bg-white hover:bg-cyan-50/50 border-cyan-200 hover:border-cyan-400 shadow-lg shadow-cyan-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform ${
                                            isDark ? 'shadow-lg shadow-cyan-500/40' : 'shadow-xl shadow-cyan-400/60 ring-4 ring-cyan-100'
                                        }`}>
                                            <Smartphone className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-bold block text-base sm:text-lg ${isDark ? 'text-white' : 'text-slate-700'}`}>التحقق بالهاتف</span>
                                            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>رقم الجوال المسجل في الحجز</span>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all ${isDark ? 'text-slate-500' : 'text-cyan-400'}`} />
                                </button>
                                
                                {/* Footer message */}
                                <div className={`text-center pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                                        نتمنى لك إقامة سعيدة ✨
                                    </p>
                                </div>
                            </div>
                        ) : (
                            /* ============================================
                               STEP 1/2: Input with Premium Keypad
                               ============================================ */
                            <div className="space-y-4">
                                {/* Step Indicator for Identity */}
                                {verifyType === 'identity' && (
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                            inputStep === 'identity' 
                                                ? 'bg-teal-500 text-white' 
                                                : 'bg-teal-100 text-teal-600'
                                        }`}>
                                            <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">1</span>
                                            <span>الهوية</span>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                            inputStep === 'contact' 
                                                ? 'bg-teal-500 text-white' 
                                                : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                            <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-[10px]">2</span>
                                            <span>الجوال</span>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Header Icon */}
                                <div className="text-center mb-2">
                                    <div className={`w-14 h-14 rounded-2xl ${
                                        (verifyType === 'phone' || inputStep === 'contact') 
                                            ? 'bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-cyan-500/30' 
                                            : 'bg-gradient-to-br from-teal-400 to-teal-600 shadow-teal-500/30'
                                    } flex items-center justify-center mx-auto mb-2 shadow-lg`}>
                                        {(verifyType === 'phone' || inputStep === 'contact') ? (
                                            <Smartphone className="w-7 h-7 text-white" />
                                        ) : (
                                            <CreditCard className="w-7 h-7 text-white" />
                                        )}
                                    </div>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                        {inputStep === 'contact' 
                                            ? 'أدخل رقم الجوال للتواصل' 
                                            : verifyType === 'phone' 
                                                ? 'أدخل رقم الجوال المسجل' 
                                                : 'آخر 4 أرقام من الهوية أو جواز السفر'}
                                    </p>
                                </div>

                                {/* ============================================
                                    PIN DOTS for Identity (4 digits)
                                    🆕 Using shared PinDot component with animations
                                    ============================================ */}
                                {verifyType === 'identity' && inputStep === 'identity' && (
                                    <div className="flex justify-center gap-2 sm:gap-3 my-4" dir="ltr">
                                        {identityDigits.map((digit, index) => (
                                            <PinDot
                                                key={index}
                                                filled={!!digit}
                                                value={digit}
                                                index={index}
                                                isDark={isDark}
                                                size="large"
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* ============================================
                                    PHONE DISPLAY for Phone Verification
                                    ============================================ */}
                                {(verifyType === 'phone' || inputStep === 'contact') && (
                                    <div className="my-4">
                                        <div 
                                            className={`w-full border-2 rounded-xl px-4 py-4 text-center text-xl sm:text-2xl font-bold tracking-widest min-h-[60px] flex items-center justify-center transition-all ${
                                                isDark 
                                                    ? 'bg-slate-700/50 border-slate-600 text-white' 
                                                    : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300 text-slate-800'
                                            }`}
                                            dir="ltr"
                                        >
                                            {phoneDigits || (
                                                <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'} font-normal text-base`}>
                                                    أدخل الرقم
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ============================================
                                    UNIFIED KEYPAD - Using shared KeypadButton component
                                    ============================================ */}
                                <div className="grid grid-cols-3 gap-2 sm:gap-3" dir="ltr">
                                    {/* Number Keys 1-9 */}
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                        <KeypadButton
                                            key={num}
                                            value={String(num)}
                                            onClick={() => {
                                                if (verifyType === 'identity' && inputStep === 'identity') {
                                                    handleIdentityKeyPress(String(num));
                                                } else {
                                                    handlePhoneKeyPress(String(num));
                                                }
                                            }}
                                            isDark={isDark}
                                        />
                                    ))}
                                    
                                    {/* Delete/Backspace Key (Left) - Android Style ⌫ */}
                                    <KeypadButton
                                        value="delete"
                                        variant="delete"
                                        onClick={() => {
                                            if (verifyType === 'identity' && inputStep === 'identity') {
                                                handleIdentityKeyPress('delete');
                                            } else {
                                                handlePhoneKeyPress('delete');
                                            }
                                        }}
                                        isDark={isDark}
                                    />
                                    
                                    {/* Zero Key (Center) */}
                                    <KeypadButton
                                        value="0"
                                        onClick={() => {
                                            if (verifyType === 'identity' && inputStep === 'identity') {
                                                handleIdentityKeyPress('0');
                                            } else {
                                                handlePhoneKeyPress('0');
                                            }
                                        }}
                                        isDark={isDark}
                                    />
                                    
                                    {/* Empty placeholder (Right) - for balance */}
                                    <div className="h-14 sm:h-16" />
                                </div>
                                
                                {/* ============================================
                                    ACTION BUTTONS - Clear & Simple
                                    ============================================ */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    {/* Back Button */}
                                    <button
                                        onClick={() => {
                                            triggerHaptic('light');
                                            if (inputStep === 'contact') {
                                                // رجوع من الجوال للهوية - مسح كل شيء لإعادة الإدخال
                                                setInputStep('identity');
                                                setPhoneDigits('');
                                                setIdentityDigits(['', '', '', '']);
                                                setVerifyValue('');
                                            } else {
                                                // رجوع من الهوية لاختيار الطريقة
                                                setVerifyType(null);
                                                setIdentityDigits(['', '', '', '']);
                                                setPhoneDigits('');
                                            }
                                        }}
                                        className={`
                                            py-3.5 rounded-xl font-semibold text-base
                                            transition-all duration-200 transform active:scale-95
                                            flex items-center justify-center gap-2
                                            border-2
                                            ${isDark 
                                                ? 'text-slate-300 border-slate-600 hover:border-slate-500 hover:bg-slate-700/50' 
                                                : 'text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                            }
                                        `}
                                    >
                                        <ChevronRight className="w-5 h-5 rotate-180" />
                                        <span>رجوع</span>
                                    </button>
                                    
                                    {/* Confirm Button */}
                                    <button
                                        onClick={() => {
                                            if (verifyType === 'identity' && inputStep === 'identity') {
                                                if (identityDigits.filter(d => d !== '').length === 4) {
                                                    triggerHaptic('success');
                                                    setVerifyValue(identityDigits.join(''));
                                                    setInputStep('contact');
                                                } else {
                                                    triggerHaptic('error');
                                                    setVerifyError('الرجاء إدخال 4 أرقام');
                                                }
                                            } else {
                                                handleKeypadSubmit();
                                            }
                                        }}
                                        disabled={
                                            (verifyType === 'identity' && inputStep === 'identity' && identityDigits.filter(d => d !== '').length < 4) ||
                                            ((verifyType === 'phone' || inputStep === 'contact') && phoneDigits.length < 5)
                                        }
                                        className={`
                                            py-3.5 rounded-xl font-semibold text-base
                                            transition-all duration-200 transform active:scale-95
                                            flex items-center justify-center gap-2
                                            disabled:opacity-50 disabled:cursor-not-allowed
                                            text-white
                                            ${(verifyType === 'identity' && inputStep === 'identity')
                                                ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40'
                                                : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40'
                                            }
                                        `}
                                    >
                                        <span>{(verifyType === 'identity' && inputStep === 'identity') ? 'التالي' : 'تأكيد الدخول'}</span>
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* 🎯 Final Step Indicator - Only show when on final step */}
                                {(verifyType === 'phone' || inputStep === 'contact') && phoneDigits.length >= 5 && (
                                    <div className={`text-center py-2 px-4 rounded-xl ${
                                        isDark ? 'bg-emerald-900/30 border border-emerald-700/50' : 'bg-emerald-50 border border-emerald-200'
                                    }`}>
                                        <p className={`text-sm font-medium flex items-center justify-center gap-2 ${
                                            isDark ? 'text-emerald-300' : 'text-emerald-600'
                                        }`}>
                                            <Unlock className="w-4 h-4" />
                                            <span>الخطوة الأخيرة - اضغط <span className="font-bold">🔓</span> للدخول</span>
                                        </p>
                                    </div>
                                )}

                                {/* Error Message - Professional & Clear */}
                                {verifyError && (
                                    <div className={`
                                        text-center py-4 px-5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300
                                        ${isDark 
                                            ? 'bg-red-900/20 border border-red-800/50 text-red-300' 
                                            : 'bg-red-50 border border-red-200 text-red-700'
                                        }
                                    `}>
                                        <div className="flex justify-center mb-2">
                                            <AlertCircle className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
                                        </div>
                                        <p className="text-sm font-medium leading-relaxed whitespace-pre-line">
                                            {verifyError}
                                        </p>
                                    </div>
                                )}
                                
                                
                                {/* First Name Input - Collapsible */}
                                <details className={`rounded-xl ${isDark ? 'bg-slate-700/30' : 'bg-slate-50'} overflow-hidden`}>
                                    <summary className={`px-4 py-3 cursor-pointer text-sm font-medium flex items-center justify-between ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-600'}`}>
                                        <span>💡 أضف اسمك (اختياري)</span>
                                        <ChevronDown className="w-4 h-4" />
                                    </summary>
                                    <div className="px-4 pb-4">
                                        <input
                                            type="text"
                                            value={verifyFirstName}
                                            onChange={(e) => setVerifyFirstName(e.target.value)}
                                            placeholder="الاسم الأول"
                                            className={`w-full border-2 rounded-xl px-4 py-3 text-right focus:outline-none focus:ring-4 focus:ring-teal-500/10 transition-all ${
                                                isDark 
                                                    ? 'bg-slate-700/50 border-slate-600 hover:border-slate-500 focus:border-teal-500 text-white placeholder-slate-400' 
                                                    : 'bg-white border-slate-200 hover:border-slate-300 focus:border-teal-400 text-slate-700'
                                            }`}
                                        />
                                        <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                            يساعد موظف الاستقبال في التحقق السريع
                                        </p>
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                    
                    {/* Keypad Animation Styles - Unified with LoginScreen */}
                    <style>{`
                        @keyframes popIn {
                            0% { transform: scale(0.5); opacity: 0; }
                            60% { transform: scale(1.1); }
                            100% { transform: scale(1); opacity: 1; }
                        }
                    `}</style>
                </div>
                </div>

                {/* ============================================
                    DEVELOPER SIGNATURE - VERIFICATION SCREEN (DYNAMIC)
                    Matches LoginScreen.tsx footer exactly
                    ============================================ */}
                <footer 
                    className="relative z-10 w-full py-2 mt-4 text-center pointer-events-auto"
                    dir="ltr"
                >
                    <p 
                        className="text-[8px] sm:text-[9px] tracking-wide transition-all duration-300 flex items-center justify-center gap-1.5 flex-wrap px-4"
                        style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
                    >
                        {/* Copyright */}
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                            © {new Date().getFullYear()}
                        </span>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                        
                        {/* Developer Name */}
                        <span className={`font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                            {(() => {
                                try { return localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda'; } 
                                catch { return 'Ayman Abo Warda'; }
                            })()}
                        </span>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                        
                        {/* Saudi Phone - with WhatsApp dynamic greeting */}
                        <a 
                            href={`https://wa.me/${(() => {
                                try { return localStorage.getItem('adora_dev_phone_sa') || '966570707121'; } 
                                catch { return '966570707121'; }
                            })()}?text=${encodeURIComponent((() => {
                                const hour = new Date().getHours();
                                return hour >= 5 && hour < 12 ? 'صباح الخير، أنا مهتم بمشروعك' : 'مساء الخير، أنا مهتم بمشروعك';
                            })())}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`hover:underline transition-colors ${
                                isDark 
                                    ? 'text-slate-300 hover:text-teal-400' 
                                    : 'text-slate-600 hover:text-teal-600'
                            }`}
                        >
                            +{(() => {
                                try { return localStorage.getItem('adora_dev_phone_sa') || '966570707121'; } 
                                catch { return '966570707121'; }
                            })()}
                        </a>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                        
                        {/* Egypt Phone - with WhatsApp dynamic greeting */}
                        <a 
                            href={`https://wa.me/${(() => {
                                try { return localStorage.getItem('adora_dev_phone_eg') || '201500000162'; } 
                                catch { return '201500000162'; }
                            })()}?text=${encodeURIComponent((() => {
                                const hour = new Date().getHours();
                                return hour >= 5 && hour < 12 ? 'صباح الخير، أنا مهتم بمشروعك' : 'مساء الخير، أنا مهتم بمشروعك';
                            })())}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`hover:underline transition-colors ${
                                isDark 
                                    ? 'text-slate-300 hover:text-teal-400' 
                                    : 'text-slate-600 hover:text-teal-600'
                            }`}
                        >
                            +{(() => {
                                try { return localStorage.getItem('adora_dev_phone_eg') || '201500000162'; } 
                                catch { return '201500000162'; }
                            })()}
                        </a>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                        
                        {/* Developer Email */}
                        <a 
                            href={`mailto:${(() => {
                                try { return localStorage.getItem('adora_dev_email') || '77aayy@gmail.com'; } 
                                catch { return '77aayy@gmail.com'; }
                            })()}`}
                            className={`hover:underline transition-colors ${
                                isDark 
                                    ? 'text-slate-300 hover:text-teal-400' 
                                    : 'text-slate-600 hover:text-teal-600'
                            }`}
                        >
                            {(() => {
                                try { return localStorage.getItem('adora_dev_email') || '77aayy@gmail.com'; } 
                                catch { return '77aayy@gmail.com'; }
                            })()}
                        </a>
                    </p>
                </footer>

                {/* ============================================
                    PREMIUM CSS ANIMATIONS FOR GUEST VERIFICATION
                    ============================================ */}
                <style>{`
                    /* Container entrance */
                    .guest-verify-container {
                        animation: guestFadeIn 0.7s ease-out forwards;
                    }
                    @keyframes guestFadeIn {
                        0% { opacity: 0; transform: translateY(20px); }
                        100% { opacity: 1; transform: translateY(0); }
                    }
                    
                    /* Aurora animated gradient */
                    .guest-aurora-gradient {
                        background: 
                            linear-gradient(125deg, rgba(20, 184, 166, 0.15) 0%, transparent 40%),
                            linear-gradient(225deg, rgba(6, 182, 212, 0.12) 0%, transparent 40%),
                            linear-gradient(315deg, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
                        animation: guestAuroraMove 15s ease-in-out infinite;
                    }
                    @keyframes guestAuroraMove {
                        0%, 100% { opacity: 0.8; transform: scale(1) rotate(0deg); }
                        50% { opacity: 1; transform: scale(1.05) rotate(1deg); }
                    }
                    
                    /* Wave background */
                    .guest-wave-bg {
                        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%2314b8a6' fill-opacity='0.05' d='M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,202.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E");
                        background-size: cover;
                        background-position: bottom;
                        animation: guestWaveMove 8s ease-in-out infinite;
                    }
                    @keyframes guestWaveMove {
                        0%, 100% { transform: translateX(0); }
                        50% { transform: translateX(-20px); }
                    }
                    
                    /* Floating orbs */
                    .guest-orb {
                        border-radius: 50%;
                        filter: blur(60px);
                        animation: guestOrbFloat 20s ease-in-out infinite;
                    }
                    .guest-orb-1 {
                        background: radial-gradient(circle, rgba(20, 184, 166, 0.4) 0%, rgba(6, 182, 212, 0.2) 50%, transparent 70%);
                        animation-delay: 0s;
                    }
                    .guest-orb-2 {
                        background: radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(16, 185, 129, 0.15) 50%, transparent 70%);
                        animation-delay: -7s;
                    }
                    .guest-orb-3 {
                        background: radial-gradient(circle, rgba(45, 212, 191, 0.3) 0%, rgba(20, 184, 166, 0.1) 50%, transparent 70%);
                        animation-delay: -14s;
                    }
                    @keyframes guestOrbFloat {
                        0%, 100% { transform: translate(0, 0) scale(1); }
                        25% { transform: translate(30px, -20px) scale(1.1); }
                        50% { transform: translate(0, -40px) scale(1); }
                        75% { transform: translate(-30px, -20px) scale(1.1); }
                    }
                    
                    /* Hexagon pattern */
                    .guest-hex-pattern {
                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%2314b8a6' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                    }
                    
                    /* Animated lines */
                    .guest-line {
                        position: absolute;
                        height: 2px;
                        background: linear-gradient(90deg, transparent, rgba(20, 184, 166, 0.3), transparent);
                        animation: guestLineMove 8s linear infinite;
                    }
                    .guest-line-1 { top: 20%; left: -100%; width: 200%; animation-delay: 0s; }
                    .guest-line-2 { top: 50%; left: -100%; width: 200%; animation-delay: -2.5s; opacity: 0.5; }
                    .guest-line-3 { top: 80%; left: -100%; width: 200%; animation-delay: -5s; opacity: 0.3; }
                    @keyframes guestLineMove {
                        0% { transform: translateX(0) rotate(-2deg); }
                        100% { transform: translateX(50%) rotate(-2deg); }
                    }
                    
                    /* Floating shapes */
                    .guest-shape {
                        position: absolute;
                        font-size: 24px;
                        color: rgba(20, 184, 166, 0.15);
                        animation: guestShapeFloat 15s ease-in-out infinite;
                    }
                    .guest-shape-1 { top: 15%; left: 10%; animation-delay: 0s; font-size: 32px; }
                    .guest-shape-2 { top: 25%; right: 15%; animation-delay: -3s; font-size: 20px; }
                    .guest-shape-3 { bottom: 35%; left: 8%; animation-delay: -6s; font-size: 28px; }
                    .guest-shape-4 { top: 55%; right: 12%; animation-delay: -9s; font-size: 16px; }
                    .guest-shape-5 { bottom: 25%; right: 20%; animation-delay: -12s; font-size: 22px; }
                    @keyframes guestShapeFloat {
                        0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.15; }
                        25% { transform: translate(20px, -30px) rotate(90deg); opacity: 0.25; }
                        50% { transform: translate(0, -50px) rotate(180deg); opacity: 0.1; }
                        75% { transform: translate(-20px, -30px) rotate(270deg); opacity: 0.2; }
                    }
                    
                    /* Corner decorations */
                    .guest-corner-decoration { background: linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, transparent 50%); }
                    .guest-corner-tl { border-radius: 0 0 100% 0; }
                    .guest-corner-br { border-radius: 100% 0 0 0; background: linear-gradient(315deg, rgba(6, 182, 212, 0.08) 0%, transparent 50%); }
                    
                    /* Glow pulse */
                    .guest-glow-pulse { animation: guestGlowPulse 4s ease-in-out infinite; }
                    .guest-glow-pulse-delay { animation: guestGlowPulse 4s ease-in-out infinite 2s; }
                    @keyframes guestGlowPulse {
                        0%, 100% { opacity: 0.5; transform: scale(1); }
                        50% { opacity: 0.8; transform: scale(1.15); }
                    }
                    
                    /* Logo animations */
                    .guest-logo-float { animation: guestLogoFloat 4s ease-in-out infinite; }
                    @keyframes guestLogoFloat {
                        0%, 100% { transform: translateY(0) rotate(0deg); }
                        25% { transform: translateY(-6px) rotate(1deg); }
                        50% { transform: translateY(-12px) rotate(0deg); }
                        75% { transform: translateY(-6px) rotate(-1deg); }
                    }
                    
                    .guest-ping-slow { animation: guestPingSlow 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
                    @keyframes guestPingSlow {
                        0% { transform: scale(0.9); opacity: 0.5; }
                        50% { transform: scale(1.1); opacity: 0; }
                        100% { transform: scale(0.9); opacity: 0.5; }
                    }
                    
                    .guest-spin-slow { animation: guestSpinSlow 20s linear infinite; }
                    @keyframes guestSpinSlow {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    
                    /* Sparkle effects */
                    .guest-sparkle { animation: guestSparkle 2s ease-in-out infinite; }
                    .guest-sparkle-delay { animation: guestSparkle 2s ease-in-out infinite 0.5s; }
                    .guest-sparkle-delay-2 { animation: guestSparkle 2s ease-in-out infinite 1s; }
                    @keyframes guestSparkle {
                        0%, 100% { opacity: 0; transform: scale(0); }
                        50% { opacity: 1; transform: scale(1); }
                    }
                    
                    /* Logo container entrance */
                    .guest-logo-container { animation: guestLogoEntrance 1s ease-out forwards; }
                    @keyframes guestLogoEntrance {
                        0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
                        60% { transform: scale(1.1) rotate(3deg); }
                        100% { opacity: 1; transform: scale(1) rotate(0deg); }
                    }
                    
                    /* Fade up animation */
                    .guest-fade-up { animation: guestFadeUp 0.8s ease-out forwards; }
                    @keyframes guestFadeUp {
                        0% { opacity: 0; transform: translateY(20px); }
                        100% { opacity: 1; transform: translateY(0); }
                    }
                    
                    /* Logo crisp rendering */
                    .guest-logo-crisp {
                        image-rendering: -webkit-optimize-contrast;
                        image-rendering: crisp-edges;
                        -webkit-backface-visibility: hidden;
                        backface-visibility: hidden;
                        transform: translateZ(0);
                    }
                    
                    @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
                        .guest-logo-crisp { image-rendering: auto; }
                    }
                    
                    /* 🌙 Twinkling stars */
                    @keyframes twinkle {
                        0%, 100% { opacity: 0.3; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.5); }
                    }
                    
                    /* 🪐 Orbital animations - Planets around the sun */
                    .guest-orbit-1 {
                        animation: guestOrbit 12s linear infinite;
                    }
                    .guest-orbit-2 {
                        animation: guestOrbit 18s linear infinite reverse;
                    }
                    .guest-orbit-3 {
                        animation: guestOrbit 25s linear infinite;
                    }
                    @keyframes guestOrbit {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
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
                `}</style>
                </div>
            </>
        );
    }

    // ============================================================
    // MAIN RENDER
    // ============================================================

    return (
        <div 
            className={`min-h-screen relative overflow-hidden transition-all duration-[1500ms] ${isDark ? 'bg-slate-950 guest-dashboard' : 'bg-teal-50 guest-dashboard-light'}`}
            style={{ minHeight: '100dvh' }}
        >
            {/* ============================================
                🌓 THEME TOGGLE - Fixed Position (Same as LoginScreen)
                ============================================ */}
            <button
                onClick={() => toggleTheme()}
                className={`
                    fixed top-4 left-4 z-[9999]
                    w-10 h-10 rounded-full
                    flex items-center justify-center
                    transition-all duration-500 transform hover:scale-105 active:scale-95
                    ${isDark 
                        ? 'bg-slate-800 text-amber-300 border border-slate-600' 
                        : 'bg-white text-slate-600 border border-slate-200'
                    }
                    shadow-sm
                `}
                aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
                {isDark ? (
                    <Sun className="w-5 h-5" />
                ) : (
                    <Moon className="w-5 h-5" />
                )}
            </button>

            {/* ============================================
                🌅 PREMIUM ANIMATED BACKGROUND - LIGHT MODE
                ============================================ */}
            <div className={`absolute inset-0 dashboard-premium-bg transition-all duration-[1500ms] ${isDark ? 'opacity-0' : 'opacity-100'}`}>
                {/* Base gradient - Richer colors */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50" />
                
                {/* Animated aurora gradient */}
                <div className="absolute inset-0 dashboard-aurora-gradient" />
                
                {/* Wave decoration at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-64 dashboard-wave-bg" />
                
                {/* Large floating orbs with stronger colors */}
                <div className="absolute -top-32 -left-32 w-[500px] h-[500px] dashboard-orb dashboard-orb-1" />
                <div className="absolute -bottom-32 -right-32 w-[450px] h-[450px] dashboard-orb dashboard-orb-2" />
                <div className="absolute top-1/3 right-0 w-[350px] h-[350px] dashboard-orb dashboard-orb-3" />
                
                {/* Hexagon pattern */}
                <div className="absolute inset-0 dashboard-hex-pattern" />
                
                {/* Floating shapes */}
                <div className="dashboard-shape dashboard-shape-1">◆</div>
                <div className="dashboard-shape dashboard-shape-2">○</div>
                <div className="dashboard-shape dashboard-shape-3">◇</div>
                <div className="dashboard-shape dashboard-shape-4">●</div>
                <div className="dashboard-shape dashboard-shape-5">△</div>
                
                {/* Glowing accent spots */}
                <div className="absolute top-10 right-10 w-48 h-48 bg-gradient-to-br from-teal-400/30 to-cyan-400/20 rounded-full blur-3xl dashboard-glow-pulse" />
                <div className="absolute bottom-20 left-10 w-56 h-56 bg-gradient-to-br from-emerald-400/25 to-teal-400/15 rounded-full blur-3xl dashboard-glow-pulse-delay" />
                <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-orange-400/10 rounded-full blur-2xl animate-pulse" />
                
                {/* Corner decorations */}
                <div className="absolute top-0 left-0 w-64 h-64 dashboard-corner-decoration dashboard-corner-tl" />
                <div className="absolute bottom-0 right-0 w-64 h-64 dashboard-corner-decoration dashboard-corner-br" />
            </div>
            
            {/* ============================================
                🌙 PREMIUM ANIMATED BACKGROUND - DARK MODE (Night Sky)
                ============================================ */}
            <div className={`absolute inset-0 transition-all duration-[1500ms] ${isDark ? 'opacity-100' : 'opacity-0'}`}>
                {/* Deep night sky gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
                
                {/* Sunset glow at horizon */}
                <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-orange-900/20 via-purple-900/10 to-transparent" />
                
                {/* Aurora borealis effect */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
                    <div className="absolute top-20 right-1/4 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/10 via-indigo-500/5 to-transparent blur-3xl animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
                </div>
                
                {/* Twinkling stars */}
                <div className="absolute inset-0">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={`star-${i}`}
                            className="absolute rounded-full bg-white dashboard-star-twinkle"
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
                
                {/* Shooting star occasional */}
                <div className="absolute top-1/4 right-1/4 w-1 h-1 bg-white rounded-full dashboard-shooting-star" />
                
                {/* Subtle clouds/mist at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-900/50 to-transparent" />
            </div>
            
            {/* Glowing accent - Theme aware */}
            <div className={`absolute top-10 right-10 w-48 h-48 rounded-full blur-3xl dashboard-glow-pulse transition-all duration-[1500ms] pointer-events-none ${
                isDark 
                    ? 'bg-gradient-to-br from-purple-500/20 to-indigo-500/10' 
                    : 'bg-gradient-to-br from-teal-400/30 to-cyan-400/20'
            }`} />
            <div className={`absolute bottom-20 left-10 w-56 h-56 rounded-full blur-3xl dashboard-glow-pulse-delay transition-all duration-[1500ms] pointer-events-none ${
                isDark 
                    ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/10' 
                    : 'bg-gradient-to-br from-emerald-400/25 to-teal-400/15'
            }`} />

            {/* 🆕 VIP Glow Effect - Theme aware */}
            {guestVipLevel === 'gold' && (
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse pointer-events-none ${
                    isDark ? 'bg-amber-500/10' : 'bg-amber-500/5'
                }`} />
            )}
            {guestVipLevel === 'platinum' && (
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse pointer-events-none ${
                    isDark ? 'bg-purple-500/10' : 'bg-purple-500/5'
                }`} />
            )}

            {/* ✅ Guest Tour Guide - Shown only 2 times */}
            {session && resolvedBranch && (
                <GuestTourGuide
                    roomNumber={session.roomNumber || resolvedRoom || ''}
                    branchId={resolvedBranch}
                />
            )}

            {/* ✅ Demo Mode Banner */}
            {isDemoMode && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-center py-2 px-4 text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-lg">🎮</span>
                        <span>وضع التجربة - Demo Mode</span>
                        <span className="hidden sm:inline opacity-75">| لا يمكن إرسال طلبات فعلية</span>
                    </div>
                </div>
            )}

            {/* 🆕 VIP Welcome Banner (للنزلاء المميزين) */}
            {isReturningGuest && guestVipLevel && guestVipLevel !== 'new' && (
                <VIPWelcomeBanner
                    guestName={session?.guestName}
                    vipLevel={guestVipLevel as any}
                    totalVisits={parseInt(localStorage.getItem('adora_guest_visits') || '1')}
                />
            )}

            {/* Header */}
            <div className="relative z-10 p-6 pb-0">
                {/* Top Bar with Logo */}
                <div className="flex justify-between items-center mb-6">
                    <img
                        src="/adora-logo.png"
                        alt="Adora"
                        className="h-10 w-auto object-contain"
                        style={{ filter: isDark ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.3))' : 'drop-shadow(0 0 10px rgba(45, 212, 191, 0.3))' }}
                    />
                    <div className="flex items-center gap-2">
                        {/* Announcements Bell Button */}
                        <button
                            onClick={handleOpenAnnouncements}
                            className={`relative p-3 rounded-xl transition-all ${
                                isDark 
                                    ? 'bg-slate-800/80 text-slate-300 border border-slate-600/50 hover:bg-slate-700'
                                    : 'bg-white/80 text-slate-600 border border-slate-200/50 hover:bg-white'
                            }`}
                            title="التنبيهات"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <>
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white animate-pulse">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                </>
                            )}
                        </button>
                        <button
                            onClick={toggleDoNotDisturb}
                            className={`p-3 rounded-xl transition-all ${doNotDisturb
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : isDark 
                                    ? 'bg-slate-800/80 text-slate-300 border border-slate-600/50 hover:bg-slate-700'
                                    : 'bg-white/80 text-slate-600 border border-slate-200/50 hover:bg-white'
                            }`}
                            title={doNotDisturb ? 'إلغاء عدم الإزعاج' : 'عدم الإزعاج'}
                        >
                            <Moon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={logoutGuest}
                            className={`p-3 rounded-xl transition-all ${
                                isDark 
                                    ? 'bg-slate-800/80 text-slate-300 border border-slate-600/50 hover:bg-slate-700'
                                    : 'bg-white/80 text-slate-600 border border-slate-200/50 hover:bg-white'
                            }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Guest Welcome Card - Theme Aware */}
                <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-4 sm:mb-6 shadow-xl transition-all duration-500 ${
                    isDark 
                        ? 'bg-slate-800/95 border border-slate-700 shadow-slate-900/30' 
                        : 'bg-white border border-teal-100 shadow-teal-900/10'
                }`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <p className={`text-xs sm:text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{updateDynamicGreeting()}</p>
                            <h1 className={`text-xl sm:text-2xl font-bold mb-2 truncate ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {session.guestName}
                            </h1>
                            <div className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-teal-500 to-teal-600 shadow-lg shadow-teal-500/30">
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse" />
                                <span className="text-white font-medium text-xs sm:text-sm">غرفة {session.roomNumber}</span>
                            </div>
                        </div>
                        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${
                            isDark 
                                ? 'bg-gradient-to-br from-teal-500/30 to-teal-600/20 border border-teal-500/30' 
                                : 'bg-gradient-to-br from-teal-100 to-teal-50 border border-teal-200'
                        }`}>
                            <span className="text-2xl sm:text-3xl">🏨</span>
                        </div>
                    </div>
                </div>

                {/* ✅ Location/Device/Room Status Errors Banner */}
                {(locationError || deviceError || roomStatusError) && (
                    <div className="space-y-2 mb-4 sm:mb-6">
                        {roomStatusError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                    <DoorClosed className="w-5 h-5 text-red-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-red-400 font-semibold text-sm sm:text-base mb-1">حالة الغرفة</p>
                                    <p className="text-red-300/80 text-xs sm:text-sm">{roomStatusError}</p>
                                </div>
                                <button onClick={() => setRoomStatusError(null)} className="text-red-400/60 hover:text-red-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        {deviceError && (
                            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                    <Smartphone className="w-5 h-5 text-orange-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-orange-400 font-semibold text-sm sm:text-base mb-1">حد الأجهزة</p>
                                    <p className="text-orange-300/80 text-xs sm:text-sm">{deviceError}</p>
                                </div>
                                <button onClick={() => setDeviceError(null)} className="text-orange-400/60 hover:text-orange-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                        {locationError && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-5 h-5 text-yellow-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-yellow-400 font-semibold text-sm sm:text-base mb-1">الموقع</p>
                                    <p className="text-yellow-300/80 text-xs sm:text-sm">{locationError}</p>
                                </div>
                                <button onClick={() => setLocationError(null)} className="text-yellow-400/60 hover:text-yellow-400">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Emergency Alert Banner (Critical Only) */}
                {emergencyAlerts.filter(a => a.severity === 'critical' && !alertReadStatuses[a.id]?.dismissedAt).length > 0 && (
                    <div className="mb-4 sm:mb-6">
                        {emergencyAlerts
                            .filter(a => a.severity === 'critical' && !alertReadStatuses[a.id]?.dismissedAt)
                            .slice(0, 1)
                            .map(alert => (
                                <div
                                    key={alert.id}
                                    onClick={() => {
                                        setCurrentEmergencyAlert(alert);
                                        setShowEmergencyAlertModal(true);
                                        handleEmergencyAlertRead(alert.id);
                                    }}
                                    className="bg-gradient-to-r from-red-600 to-red-500 border-2 border-red-400 rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all animate-pulse"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-3xl animate-bounce">🚨</div>
                                        <div className="flex-1">
                                            <h3 className="text-white font-bold text-base sm:text-lg mb-1">
                                                {alert.titleAr || alert.title}
                                            </h3>
                                            <p className="text-white/90 text-sm line-clamp-2">
                                                {alert.messageAr || alert.message}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-white/80 flex-shrink-0" />
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {/* ✅ Room Transfer Notification Banner */}
                {roomTransferNotification && (
                    <div className="bg-gradient-to-r from-orange-500/30 to-red-500/20 border border-orange-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-4 sm:mb-6 animate-in zoom-in-95 fade-in duration-300">
                        <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl bg-orange-500/30 flex items-center justify-center flex-shrink-0">
                                <DoorClosed className="w-7 h-7 text-orange-400 animate-pulse" />
                            </div>
                            <div className="flex-1">
                                <p className="text-white font-bold text-lg mb-1">🚚 تم نقلك لغرفة جديدة!</p>
                                <p className="text-orange-200 text-sm mb-2">{roomTransferNotification.message}</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-white/60">الغرفة الجديدة:</span>
                                    <span className="px-4 py-1.5 bg-green-500/30 rounded-lg text-green-400 font-mono font-bold text-lg">
                                        {roomTransferNotification.newRoom}
                                    </span>
                                </div>
                                <p className="text-[10px] text-white/40 mt-2">
                                    سيتم تحديث جميع طلباتك تلقائياً للغرفة الجديدة
                                </p>
                            </div>
                            <button
                                onClick={() => setRoomTransferNotification(null)}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Active Requests Banner */}
                {activeRequests.length > 0 && (
                    <div
                        className="bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 flex items-center justify-between cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all touch-manipulation"
                        onClick={() => setTrackedRequest(activeRequests[0])}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <Bell className="w-6 h-6 text-amber-400 animate-bounce" />
                            </div>
                            <div>
                                <p className="text-white font-semibold">{activeRequests.length} طلب نشط</p>
                                <p className="text-amber-400/80 text-sm">{getStatusLabel(activeRequests[0].status)} • اضغط للتتبع</p>
                            </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-amber-400/60" />
                    </div>
                )}
            </div>

            {/* Tabs - Theme Aware */}
            <div className="relative z-10 flex gap-2 px-6 mb-6">
                {[
                    { id: 'services', label: 'الخدمات', icon: '✨' },
                    { id: 'history', label: 'السجل', icon: '📋' },
                    { id: 'extras', label: 'المزيد', icon: '🎯' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`flex-1 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl font-medium transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 active:scale-95 touch-manipulation ripple ${currentTab === tab.id
                            ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/25 scale-105'
                            : isDark 
                                ? 'bg-slate-800/80 text-slate-300 border border-slate-600/50 hover:bg-slate-700 hover:scale-105'
                                : 'bg-white/80 text-slate-600 border border-slate-200/50 hover:bg-white hover:scale-105'
                            }`}
                        onClick={(e) => {
                            haptic('medium');
                            playSound('click');
                            switchTab(tab.id as any);
                        }}
                    >
                        <span>{tab.icon}</span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="relative z-10 px-4 sm:px-6 pb-24 sm:pb-32">
                {/* Services Tab - Mobile Optimized - Theme Aware */}
                {currentTab === 'services' && (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {/* Standard Services */}
                        {SERVICES.filter(service => isServiceEnabled(service.type)).map((service, index) => (
                            <button
                                key={service.type}
                                onClick={(e) => {
                                    haptic('light');
                                    playSound('click');
                                    handleServiceClick(service);
                                }}
                                className={`group relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col items-center gap-2 sm:gap-4 hover:scale-[1.05] active:scale-[0.95] hover:border-teal-500/50 transition-all duration-300 overflow-hidden touch-manipulation ripple zoom-on-hover shadow-lg ${
                                    isDark 
                                        ? 'bg-slate-800/90 border border-slate-700 shadow-slate-900/30' 
                                        : 'bg-white border border-slate-200 shadow-slate-200/50'
                                }`}
                                style={{ 
                                    animationDelay: `${index * 100}ms`,
                                    animation: 'fadeIn 0.4s ease-out forwards'
                                }}
                            >
                                {/* Glow effect on hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/10 group-hover:to-transparent transition-all rounded-2xl sm:rounded-3xl" />

                                <div className={`relative w-14 h-14 sm:w-18 sm:h-18 rounded-xl sm:rounded-2xl ${service.bgColor} flex items-center justify-center ${service.color} group-hover:scale-110 transition-transform`}
                                >
                                    {service.icon}
                                </div>
                                <span className={`relative font-semibold text-sm sm:text-lg text-center leading-tight ${isDark ? 'text-white' : 'text-slate-700'}`}>{service.nameAr}</span>

                                {/* Decorative corner */}
                                <div className={`absolute top-0 left-0 w-16 h-16 rounded-br-full ${isDark ? 'bg-gradient-to-br from-white/5 to-transparent' : 'bg-gradient-to-br from-teal-50 to-transparent'}`} />
                            </button>
                        ))}
                        
                        {/* Dynamic QR Services */}
                        {dynamicServices.map((qrService, index) => (
                            <button
                                key={qrService.id}
                                onClick={(e) => {
                                    haptic('light');
                                    playSound('click');
                                    handleQRServiceClick(qrService);
                                }}
                                className={`group relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col items-center gap-2 sm:gap-4 hover:scale-[1.05] active:scale-[0.95] hover:border-purple-500/50 transition-all duration-300 overflow-hidden touch-manipulation ripple zoom-on-hover shadow-lg ${
                                    isDark 
                                        ? 'bg-slate-800/90 border border-slate-700 shadow-slate-900/30' 
                                        : 'bg-white border border-slate-200 shadow-slate-200/50'
                                }`}
                                style={{ 
                                    animationDelay: `${(SERVICES.length + index) * 100}ms`,
                                    animation: 'fadeIn 0.4s ease-out forwards'
                                }}
                            >
                                {/* Glow effect on hover */}
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/10 group-hover:to-transparent transition-all rounded-2xl sm:rounded-3xl" />

                                <div className={`relative w-14 h-14 sm:w-18 sm:h-18 rounded-xl sm:rounded-2xl ${qrService.bgColor || 'bg-purple-500/20'} flex items-center justify-center ${qrService.color || 'text-purple-400'} group-hover:scale-110 transition-transform text-3xl`}
                                >
                                    {qrService.icon || '✨'}
                                </div>
                                <span className={`relative font-semibold text-sm sm:text-lg text-center leading-tight ${isDark ? 'text-white' : 'text-slate-700'}`}>{qrService.name}</span>
                                {qrService.description && (
                                    <span className={`relative text-xs text-center leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{qrService.description}</span>
                                )}
                                {qrService.hasPricing && qrService.price && (
                                    <span className="relative text-green-500 text-xs font-medium">{qrService.price} ر.س</span>
                                )}

                                {/* Decorative corner */}
                                <div className={`absolute top-0 left-0 w-16 h-16 rounded-br-full ${isDark ? 'bg-gradient-to-br from-white/5 to-transparent' : 'bg-gradient-to-br from-purple-50 to-transparent'}`} />
                            </button>
                        ))}
                    </div>
                )}

                {/* History Tab - Theme Aware */}
                {currentTab === 'history' && (
                    <div className="space-y-3">
                        {recentRequests.length === 0 ? (
                            <div className="text-center py-16">
                                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                                    <History className={`w-10 h-10 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                                </div>
                                <p className={isDark ? 'text-slate-500' : 'text-slate-400'}>لا توجد طلبات سابقة</p>
                            </div>
                        ) : (
                            recentRequests.map((req, index) => (
                                <div
                                    key={req.id}
                                    className={`rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between active:scale-95 transition-all touch-manipulation shadow-md ${
                                        isDark 
                                            ? 'bg-slate-800/90 border border-slate-700 hover:bg-slate-700/90 shadow-slate-900/30' 
                                            : 'bg-white border border-slate-200 hover:bg-slate-50 shadow-slate-200/50'
                                    }`}
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                                            {req.type === 'cleaning' && <Sparkles className="w-6 h-6 text-teal-400" />}
                                            {req.type === 'maintenance' && <Wrench className="w-6 h-6 text-orange-400" />}
                                            {req.type === 'bellman' && <BellRing className="w-6 h-6 text-purple-400" />}
                                            {!['cleaning', 'maintenance', 'bellman'].includes(req.type) && <Package className="w-6 h-6 text-amber-400" />}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isDark ? 'text-white' : 'text-slate-700'}`}>{getServiceDisplayName(req.type)}</p>
                                            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatTime(req.createdAt)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* ✅ زر طلب مرة أخرى */}
                                        {req.status === 'COMPLETED' && (
                                            <button
                                                onClick={() => {
                                                    // Find matching service
                                                    const service = SERVICES.find(s => s.type === req.type);
                                                    if (service) {
                                                        setSelectedService(service);
                                                        setRequestNotes(req.notes || '');
                                                        setShowRequestModal(true);
                                                        haptic?.('light');
                                                    }
                                                }}
                                                className="p-2 rounded-xl bg-teal-500/20 text-teal-500 hover:bg-teal-500/30 transition-all"
                                                title="طلب مرة أخرى"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        {/* Rating */}
                                        {req.rating ? (
                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <Star key={i} className={`w-4 h-4 ${i <= req.rating! ? 'text-amber-400 fill-amber-400' : isDark ? 'text-slate-600' : 'text-slate-200'}`} />
                                                ))}
                                            </div>
                                        ) : req.status === 'COMPLETED' ? (
                                            <button
                                                onClick={() => openRatingModal(req)}
                                                className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-500 text-sm font-medium hover:bg-amber-500/30 transition-all"
                                            >
                                                تقييم
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Extras Tab - Theme Aware */}
                {currentTab === 'extras' && (
                    <div className="space-y-4">
                        <button
                            onClick={callReception}
                            className={`w-full rounded-2xl p-5 flex items-center gap-4 hover:scale-[1.02] transition-all shadow-lg ${
                                isDark 
                                    ? 'bg-slate-800/90 border border-green-500/30 shadow-slate-900/30' 
                                    : 'bg-white border border-green-200 shadow-green-100/50'
                            }`}
                        >
                            <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <Phone className="w-7 h-7 text-green-500" />
                            </div>
                            <div className="text-right flex-1">
                                <span className={`font-semibold block ${isDark ? 'text-white' : 'text-slate-700'}`}>اتصال بالاستقبال</span>
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>تحدث مباشرة مع الموظف</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-green-500/50" />
                        </button>

                        <button
                            onClick={openWhatsApp}
                            className={`w-full rounded-2xl p-5 flex items-center gap-4 hover:scale-[1.02] transition-all shadow-lg ${
                                isDark 
                                    ? 'bg-slate-800/90 border border-emerald-500/30 shadow-slate-900/30' 
                                    : 'bg-white border border-emerald-200 shadow-emerald-100/50'
                            }`}
                        >
                            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <MessageCircle className="w-7 h-7 text-emerald-500" />
                            </div>
                            <div className="text-right flex-1">
                                <span className={`font-semibold block ${isDark ? 'text-white' : 'text-slate-700'}`}>واتساب</span>
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>راسلنا على الواتساب</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-emerald-500/50" />
                        </button>

                        <button
                            onClick={requestExtension}
                            className={`w-full rounded-2xl p-5 flex items-center gap-4 hover:scale-[1.02] transition-all shadow-lg ${
                                isDark 
                                    ? 'bg-slate-800/90 border border-blue-500/30 shadow-slate-900/30' 
                                    : 'bg-white border border-blue-200 shadow-blue-100/50'
                            }`}
                        >
                            <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Clock className="w-7 h-7 text-blue-500" />
                            </div>
                            <div className="text-right flex-1">
                                <span className={`font-semibold block ${isDark ? 'text-white' : 'text-slate-700'}`}>طلب تمديد الإقامة</span>
                                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>تمديد فترة إقامتك</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-blue-500/50" />
                        </button>

                        {/* DND Status - Theme Aware */}
                        <div className={`mt-6 p-4 rounded-2xl border shadow-lg ${
                            doNotDisturb 
                                ? 'bg-red-500/10 border-red-500/30' 
                                : isDark 
                                    ? 'bg-slate-800/90 border-slate-700 shadow-slate-900/30' 
                                    : 'bg-white border-slate-200 shadow-slate-200/50'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Moon className={`w-5 h-5 ${doNotDisturb ? 'text-red-400' : isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                                    <span className={doNotDisturb ? 'text-red-400' : isDark ? 'text-slate-300' : 'text-slate-600'}>
                                        {doNotDisturb ? 'وضع عدم الإزعاج مفعل' : 'وضع عدم الإزعاج'}
                                    </span>
                                </div>
                                <button
                                    onClick={toggleDoNotDisturb}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${doNotDisturb
                                        ? 'bg-red-500 text-white'
                                        : isDark 
                                            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {doNotDisturb ? 'إلغاء' : 'تفعيل'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Request Modal */}
            {showRequestModal && selectedService && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-end" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="w-full bg-slate-900 border-t border-white/10 rounded-t-3xl max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">{selectedService.nameAr}</h2>
                                <button onClick={() => setShowRequestModal(false)} className="text-white/60">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <textarea
                                    value={requestNotes}
                                    onChange={(e) => setRequestNotes(e.target.value)}
                                    placeholder="ملاحظات إضافية..."
                                    rows={3}
                                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white resize-none"
                                />

                                {selectedService.type === 'maintenance' && (
                                    <div>
                                        <label className="block text-white/60 mb-2">صورة المشكلة (اختياري)</label>
                                        {requestPhoto ? (
                                            <div className="relative">
                                                <img src={requestPhoto} className="w-full h-40 object-cover rounded-xl" />
                                                <button onClick={removePhoto} className="absolute top-2 right-2 bg-red-500 p-1 rounded-full">
                                                    <X className="w-4 h-4 text-white" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => photoInputRef.current?.click()}
                                                className="w-full py-8 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center gap-2 text-white/40"
                                            >
                                                <Camera className="w-8 h-8" />
                                                <span>التقاط صورة</span>
                                            </button>
                                        )}
                                        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
                                    </div>
                                )}

                                {/* Schedule Picker - For cleaning and bellman services */}
                                {['cleaning', 'bellman'].includes(selectedService.type) && (
                                    <div>
                                        <label className="block text-white/60 mb-2">جدولة الخدمة (اختياري)</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setScheduleTime('')}
                                                className={`py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${!scheduleTime ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/70'
                                                    }`}
                                            >
                                                <Bell className="w-4 h-4" />
                                                الآن
                                            </button>
                                            <div className="relative">
                                                <input
                                                    type="time"
                                                    value={scheduleTime}
                                                    onChange={(e) => setScheduleTime(e.target.value)}
                                                    className={`w-full py-3 px-4 rounded-xl text-center transition-all ${scheduleTime ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/70'
                                                        }`}
                                                />
                                            </div>
                                        </div>
                                        {scheduleTime && (
                                            <p className="text-primary-400 text-sm mt-2 text-center">
                                                سيتم تنفيذ الطلب في الساعة {scheduleTime}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <button
                                    onClick={submitRequest}
                                    disabled={isSubmitting}
                                    className="w-full btn-primary py-4 disabled:opacity-50"
                                >
                                    {isSubmitting ? <AdoraLoaderInline size={20} /> : 'إرسال الطلب'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dynamic QR Service Modal */}
            {showQRServiceModal && selectedQRService && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-end" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="w-full bg-slate-900 border-t border-white/10 rounded-t-3xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{selectedQRService.name}</h2>
                                    {selectedQRService.description && (
                                        <p className="text-white/60 text-sm mt-1">{selectedQRService.description}</p>
                                    )}
                                </div>
                                <button onClick={() => setShowQRServiceModal(false)} className="text-white/60">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Price Display */}
                            {selectedQRService.hasPricing && selectedQRService.price && (
                                <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/60">{selectedQRService.priceLabel || 'السعر'}</span>
                                        <span className="text-green-400 font-bold text-lg">{selectedQRService.price} ر.س</span>
                                    </div>
                                </div>
                            )}

                            {/* Time Restrictions Info */}
                            {selectedQRService.timeRestrictions?.enabled && (
                                <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                                    <p className="text-blue-400 text-sm text-center">
                                        متاح من {selectedQRService.timeRestrictions.startTime} إلى {selectedQRService.timeRestrictions.endTime}
                                    </p>
                                </div>
                            )}

                            <div className="space-y-4">
                                {/* Dynamic Form Fields */}
                                {selectedQRService.fields?.map((field, index) => (
                                    <div key={index}>
                                        <label className="block text-white/60 mb-2">
                                            {field.label}
                                            {field.required && <span className="text-red-400 mr-1">*</span>}
                                        </label>
                                        
                                        {field.type === 'textarea' && (
                                            <textarea
                                                value={qrServiceFormData[field.key] || ''}
                                                onChange={(e) => setQRServiceFormData({ ...qrServiceFormData, [field.key]: e.target.value })}
                                                placeholder={field.placeholder || ''}
                                                rows={3}
                                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white resize-none focus:border-teal-500 focus:outline-none"
                                            />
                                        )}
                                        
                                        {field.type === 'select' && (
                                            <select
                                                value={qrServiceFormData[field.key] || ''}
                                                onChange={(e) => setQRServiceFormData({ ...qrServiceFormData, [field.key]: e.target.value })}
                                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:outline-none"
                                            >
                                                <option value="">اختر...</option>
                                                {field.options?.map((opt, optIdx) => (
                                                    <option key={optIdx} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                        
                                        {field.type === 'boolean' && (
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setQRServiceFormData({ ...qrServiceFormData, [field.key]: true })}
                                                    className={`flex-1 py-3 rounded-xl ${qrServiceFormData[field.key] === true ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/10 text-white/60 border border-white/20'}`}
                                                >
                                                    نعم
                                                </button>
                                                <button
                                                    onClick={() => setQRServiceFormData({ ...qrServiceFormData, [field.key]: false })}
                                                    className={`flex-1 py-3 rounded-xl ${qrServiceFormData[field.key] === false ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-white/60 border border-white/20'}`}
                                                >
                                                    لا
                                                </button>
                                            </div>
                                        )}
                                        
                                        {['text', 'number', 'time', 'date', 'datetime'].includes(field.type) && (
                                            <input
                                                type={field.type === 'datetime' ? 'datetime-local' : field.type}
                                                value={qrServiceFormData[field.key] || ''}
                                                onChange={(e) => setQRServiceFormData({ ...qrServiceFormData, [field.key]: e.target.value })}
                                                placeholder={field.placeholder || ''}
                                                min={field.min}
                                                max={field.max}
                                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:outline-none"
                                            />
                                        )}
                                    </div>
                                ))}

                                {(!selectedQRService.fields || selectedQRService.fields.length === 0) && (
                                    <p className="text-white/40 text-center py-4">لا توجد حقول إضافية</p>
                                )}

                                <button
                                    onClick={handleQRServiceSubmit}
                                    disabled={isSubmitting}
                                    className="w-full btn-primary py-4 disabled:opacity-50"
                                >
                                    {isSubmitting ? <AdoraLoaderInline size={20} /> : 'إرسال الطلب'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rating Modal */}
            {ratingRequest && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
                        <h2 className="text-xl font-bold text-white text-center mb-6">كيف كانت الخدمة؟</h2>
                        <div className="flex justify-center gap-2 mb-6">
                            {[1, 2, 3, 4, 5].map(i => (
                                <button key={i} onClick={() => selectRating(i)}>
                                    <Star className={`w-10 h-10 ${i <= ratingValue ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} />
                                </button>
                            ))}
                        </div>
                        <button onClick={submitRating} disabled={!ratingValue} className="w-full btn-primary py-3 disabled:opacity-50">
                            إرسال التقييم
                        </button>
                        <button onClick={closeRatingModal} className="w-full text-white/60 py-2 mt-2">
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {/* Dynamic Rating Modal */}
            {showRatingModal && ratingInvitation && ratingInvitation.template && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal with custom background */}
                    <div 
                        className="border border-white/10 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl"
                        style={{
                            background: ratingInvitation.template.backgroundColor || '#1e293b',
                            borderColor: ratingInvitation.template.primaryColor || '#10b981'
                        }}
                    >
                        {/* Header */}
                        {ratingInvitation.template.headerImage && (
                            <img 
                                src={ratingInvitation.template.headerImage} 
                                alt="Header" 
                                className="w-full h-32 object-cover rounded-2xl mb-4"
                            />
                        )}
                        
                        <div className="text-center mb-6">
                            {ratingInvitation.template.icon && (
                                <div className="text-6xl mb-4">{ratingInvitation.template.icon}</div>
                            )}
                            <h2 
                                className="text-2xl font-bold mb-2"
                                style={{ color: ratingInvitation.template.primaryColor || '#10b981' }}
                            >
                                {ratingInvitation.template.titleAr || ratingInvitation.template.title}
                            </h2>
                            {ratingInvitation.template.subtitleAr && (
                                <p className="text-white/60 text-sm">{ratingInvitation.template.subtitleAr}</p>
                            )}
                        </div>

                        {/* Questions */}
                        <div className="space-y-6 mb-6">
                            {ratingInvitation.template.questions.map((question, index) => (
                                <div key={question.id}>
                                    <label className="block text-white font-medium mb-3">
                                        {question.questionAr || question.question}
                                        {question.required && <span className="text-red-400 mr-1">*</span>}
                                    </label>

                                    {/* Star Rating */}
                                    {question.type === 'star' && (
                                        <div className="flex justify-center gap-2">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleDynamicRatingChange(question.id, i)}
                                                    className="transition-transform hover:scale-125"
                                                >
                                                    <Star 
                                                        className={`w-10 h-10 ${
                                                            i <= (ratingResponses[question.id] || 0)
                                                                ? 'text-yellow-400 fill-yellow-400'
                                                                : 'text-white/20'
                                                        }`}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Emoji Rating */}
                                    {question.type === 'emoji' && (
                                        <div className="flex justify-center gap-3">
                                            {['😞', '😐', '🙂', '😊', '😍'].map((emoji, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleDynamicRatingChange(question.id, i + 1)}
                                                    className={`text-4xl transition-transform hover:scale-125 ${
                                                        ratingResponses[question.id] === i + 1 ? 'scale-125' : ''
                                                    }`}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Text Input */}
                                    {question.type === 'text' && (
                                        <textarea
                                            value={ratingResponses[question.id] || ''}
                                            onChange={(e) => handleDynamicRatingChange(question.id, e.target.value)}
                                            placeholder={question.placeholder || ''}
                                            rows={3}
                                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white resize-none focus:border-teal-500 focus:outline-none"
                                        />
                                    )}

                                    {/* Number Input */}
                                    {question.type === 'number' && (
                                        <input
                                            type="number"
                                            value={ratingResponses[question.id] || ''}
                                            onChange={(e) => handleDynamicRatingChange(question.id, parseInt(e.target.value) || 0)}
                                            min={question.min}
                                            max={question.max}
                                            placeholder={question.placeholder || ''}
                                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:border-teal-500 focus:outline-none"
                                        />
                                    )}

                                    {/* Yes/No */}
                                    {question.type === 'yes_no' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleDynamicRatingChange(question.id, true)}
                                                className={`flex-1 py-3 rounded-xl ${
                                                    ratingResponses[question.id] === true
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : 'bg-white/10 text-white/60 border border-white/20'
                                                }`}
                                            >
                                                نعم
                                            </button>
                                            <button
                                                onClick={() => handleDynamicRatingChange(question.id, false)}
                                                className={`flex-1 py-3 rounded-xl ${
                                                    ratingResponses[question.id] === false
                                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        : 'bg-white/10 text-white/60 border border-white/20'
                                                }`}
                                            >
                                                لا
                                            </button>
                                        </div>
                                    )}

                                    {/* Multiple Choice */}
                                    {question.type === 'multiple_choice' && question.options && (
                                        <div className="space-y-2">
                                            {question.options.map((option, optIdx) => (
                                                <button
                                                    key={optIdx}
                                                    onClick={() => handleDynamicRatingChange(question.id, option.value)}
                                                    className={`w-full py-3 rounded-xl text-right px-4 ${
                                                        ratingResponses[question.id] === option.value
                                                            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                                                            : 'bg-white/10 text-white/60 border border-white/20 hover:bg-white/20'
                                                    }`}
                                                >
                                                    {option.labelAr || option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleDismissRating}
                                className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                            >
                                تخطي
                            </button>
                            <button
                                onClick={handleSubmitDynamicRating}
                                disabled={ratingSubmitting}
                                className="flex-1 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-50"
                                style={{
                                    background: `linear-gradient(to right, ${ratingInvitation.template.primaryColor || '#10b981'}, ${ratingInvitation.template.primaryColor || '#10b981'}dd)`
                                }}
                            >
                                {ratingSubmitting ? (
                                    <AdoraLoaderInline size={20} />
                                ) : (
                                    'إرسال التقييم'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Announcements Modal */}
            {showAnnouncementsModal && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="bg-slate-900 border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl">
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                                        <Bell className="w-6 h-6 text-red-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">التنبيهات والإعلانات</h2>
                                        {unreadCount > 0 && (
                                            <p className="text-red-400 text-sm">{unreadCount} تنبيه جديد</p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAnnouncementsModal(false)}
                                    className="text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Announcements List */}
                            <div className="space-y-4">
                                {announcements.length === 0 ? (
                                    <div className="text-center py-12 text-white/40">
                                        <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p>لا توجد تنبيهات حالياً</p>
                                    </div>
                                ) : (
                                    getVisibleAnnouncements(announcements, announcementReadStatuses).map((announcement) => {
                                        const isRead = announcementReadStatuses[announcement.id];
                                        const isNew = !isRead || isRead.readCount === 0;
                                        
                                        return (
                                            <div
                                                key={announcement.id}
                                                onClick={() => handleAnnouncementRead(announcement.id)}
                                                className={`p-4 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] ${
                                                    isNew
                                                        ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30'
                                                        : 'bg-white/5 border-white/10'
                                                }`}
                                            >
                                                {/* Priority Badge */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        {announcement.icon && (
                                                            <span className="text-2xl">{announcement.icon}</span>
                                                        )}
                                                        <h3 className={`font-bold ${isNew ? 'text-white' : 'text-white/80'}`}>
                                                            {announcement.titleAr || announcement.title}
                                                        </h3>
                                                    </div>
                                                    {isNew && (
                                                        <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                                                            جديد
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <p className={`text-sm leading-relaxed mb-3 ${isNew ? 'text-white/90' : 'text-white/70'}`}>
                                                    {announcement.contentAr || announcement.content}
                                                </p>

                                                {/* Priority Indicator */}
                                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        announcement.priority === 'high'
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : announcement.priority === 'medium'
                                                            ? 'bg-yellow-500/20 text-yellow-400'
                                                            : 'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                        {announcement.priority === 'high' ? 'مهم' : announcement.priority === 'medium' ? 'متوسط' : 'عادي'}
                                                    </span>
                                                    {isRead && (
                                                        <span className="text-xs text-white/40">
                                                            تمت القراءة {isRead.readCount > 1 ? `(${isRead.readCount} مرة)` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer Info */}
                            {announcements.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-white/10 text-center text-white/40 text-xs">
                                    <p>انقر على أي تنبيه لتمييزه كمقروء</p>
                                    <p className="mt-1">
                                        {getVisibleAnnouncements(announcements, announcementReadStatuses).length} من {announcements.length} تنبيه متاح
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Emergency Alert Modal */}
            {showEmergencyAlertModal && currentEmergencyAlert && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-pulse" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div 
                        className={`bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden border-4 ${
                            currentEmergencyAlert.severity === 'critical'
                                ? 'border-red-500 animate-pulse'
                                : currentEmergencyAlert.severity === 'high'
                                ? 'border-orange-500'
                                : 'border-yellow-500'
                        }`}
                        style={{
                            animation: currentEmergencyAlert.severity === 'critical' ? 'pulse 1s infinite' : 'none'
                        }}
                    >
                        {/* Critical Alert Header */}
                        {currentEmergencyAlert.severity === 'critical' && (
                            <div className="bg-gradient-to-r from-red-600 to-red-500 p-4 text-center">
                                <div className="text-4xl mb-2 animate-bounce">🚨</div>
                                <h3 className="text-white font-bold text-lg">تنبيه طارئ حرج</h3>
                            </div>
                        )}

                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                        currentEmergencyAlert.severity === 'critical'
                                            ? 'bg-red-500/20'
                                            : currentEmergencyAlert.severity === 'high'
                                            ? 'bg-orange-500/20'
                                            : 'bg-yellow-500/20'
                                    }`}>
                                        <span className="text-2xl">
                                            {currentEmergencyAlert.type === 'fire' ? '🔥' :
                                             currentEmergencyAlert.type === 'evacuation' ? '🚨' :
                                             currentEmergencyAlert.type === 'security' ? '🔒' :
                                             currentEmergencyAlert.type === 'weather' ? '⛈️' :
                                             '⚠️'}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className={`text-xl font-bold ${
                                            currentEmergencyAlert.severity === 'critical' ? 'text-red-400' :
                                            currentEmergencyAlert.severity === 'high' ? 'text-orange-400' :
                                            'text-yellow-400'
                                        }`}>
                                            {currentEmergencyAlert.titleAr || currentEmergencyAlert.title}
                                        </h2>
                                        <p className="text-white/60 text-xs">
                                            {new Date(currentEmergencyAlert.createdAt?.toDate ? currentEmergencyAlert.createdAt.toDate() : currentEmergencyAlert.createdAt).toLocaleString('ar-SA')}
                                        </p>
                                    </div>
                                </div>
                                {currentEmergencyAlert.dismissible && (
                                    <button
                                        onClick={() => handleDismissEmergencyAlert(currentEmergencyAlert.id)}
                                        className="text-white/60 hover:text-white transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                )}
                            </div>

                            {/* Message */}
                            <div className={`p-4 rounded-xl mb-4 ${
                                currentEmergencyAlert.severity === 'critical'
                                    ? 'bg-red-500/10 border border-red-500/30'
                                    : currentEmergencyAlert.severity === 'high'
                                    ? 'bg-orange-500/10 border border-orange-500/30'
                                    : 'bg-yellow-500/10 border border-yellow-500/30'
                            }`}>
                                <p className="text-white leading-relaxed text-base">
                                    {currentEmergencyAlert.messageAr || currentEmergencyAlert.message}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        handleEmergencyAlertRead(currentEmergencyAlert.id);
                                        setShowEmergencyAlertModal(false);
                                        setCurrentEmergencyAlert(null);
                                    }}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
                                        currentEmergencyAlert.severity === 'critical'
                                            ? 'bg-red-500 hover:bg-red-600'
                                            : currentEmergencyAlert.severity === 'high'
                                            ? 'bg-orange-500 hover:bg-orange-600'
                                            : 'bg-yellow-500 hover:bg-yellow-600'
                                    }`}
                                >
                                    فهمت
                                </button>
                                {currentEmergencyAlert.dismissible && (
                                    <button
                                        onClick={() => handleDismissEmergencyAlert(currentEmergencyAlert.id)}
                                        className="px-4 py-3 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                                    >
                                        إغلاق
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Emergency Alert Modal */}
            {showEmergencyAlertModal && currentEmergencyAlert && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div 
                        className={`bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden border-4 ${
                            currentEmergencyAlert.severity === 'critical'
                                ? 'border-red-500 animate-pulse'
                                : currentEmergencyAlert.severity === 'high'
                                ? 'border-orange-500'
                                : 'border-yellow-500'
                        }`}
                        style={{
                            animation: currentEmergencyAlert.severity === 'critical' ? 'pulse 1s infinite' : 'none'
                        }}
                    >
                        {/* Critical Alert Header */}
                        {currentEmergencyAlert.severity === 'critical' && (
                            <div className="bg-gradient-to-r from-red-600 to-red-500 p-4 text-center">
                                <div className="text-4xl mb-2 animate-bounce">🚨</div>
                                <h3 className="text-white font-bold text-lg">تنبيه طارئ حرج</h3>
                            </div>
                        )}

                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                        currentEmergencyAlert.severity === 'critical'
                                            ? 'bg-red-500/20'
                                            : currentEmergencyAlert.severity === 'high'
                                            ? 'bg-orange-500/20'
                                            : 'bg-yellow-500/20'
                                    }`}>
                                        <span className="text-2xl">
                                            {currentEmergencyAlert.type === 'fire' ? '🔥' :
                                             currentEmergencyAlert.type === 'evacuation' ? '🚨' :
                                             currentEmergencyAlert.type === 'security' ? '🔒' :
                                             currentEmergencyAlert.type === 'weather' ? '⛈️' :
                                             '⚠️'}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className={`text-xl font-bold ${
                                            currentEmergencyAlert.severity === 'critical' ? 'text-red-400' :
                                            currentEmergencyAlert.severity === 'high' ? 'text-orange-400' :
                                            'text-yellow-400'
                                        }`}>
                                            {currentEmergencyAlert.titleAr || currentEmergencyAlert.title}
                                        </h2>
                                        <p className="text-white/60 text-xs">
                                            {new Date(currentEmergencyAlert.createdAt?.toDate ? currentEmergencyAlert.createdAt.toDate() : currentEmergencyAlert.createdAt).toLocaleString('ar-SA')}
                                        </p>
                                    </div>
                                </div>
                                {currentEmergencyAlert.dismissible && (
                                    <button
                                        onClick={() => handleDismissEmergencyAlert(currentEmergencyAlert.id)}
                                        className="text-white/60 hover:text-white transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                )}
                            </div>

                            {/* Message */}
                            <div className={`p-4 rounded-xl mb-4 ${
                                currentEmergencyAlert.severity === 'critical'
                                    ? 'bg-red-500/10 border border-red-500/30'
                                    : currentEmergencyAlert.severity === 'high'
                                    ? 'bg-orange-500/10 border border-orange-500/30'
                                    : 'bg-yellow-500/10 border border-yellow-500/30'
                            }`}>
                                <p className="text-white leading-relaxed text-base">
                                    {currentEmergencyAlert.messageAr || currentEmergencyAlert.message}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        handleEmergencyAlertRead(currentEmergencyAlert.id);
                                        setShowEmergencyAlertModal(false);
                                        setCurrentEmergencyAlert(null);
                                    }}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
                                        currentEmergencyAlert.severity === 'critical'
                                            ? 'bg-red-500 hover:bg-red-600'
                                            : currentEmergencyAlert.severity === 'high'
                                            ? 'bg-orange-500 hover:bg-orange-600'
                                            : 'bg-yellow-500 hover:bg-yellow-600'
                                    }`}
                                >
                                    فهمت
                                </button>
                                {currentEmergencyAlert.dismissible && (
                                    <button
                                        onClick={() => handleDismissEmergencyAlert(currentEmergencyAlert.id)}
                                        className="px-4 py-3 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
                                    >
                                        إغلاق
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Request Tracker Modal */}
            {trackedRequest && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-end" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="w-full bg-slate-900 border-t border-white/10 rounded-t-3xl">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">تتبع الطلب</h2>
                                <button onClick={closeTracker} className="text-white/60">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Service Info */}
                            <div className="glass-card p-4 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-primary-500/20 flex items-center justify-center text-primary-400">
                                        {trackedRequest.type === 'cleaning' && <Sparkles className="w-7 h-7" />}
                                        {trackedRequest.type === 'maintenance' && <Wrench className="w-7 h-7" />}
                                        {trackedRequest.type === 'bellman' && <BellRing className="w-7 h-7" />}
                                        {!['cleaning', 'maintenance', 'bellman'].includes(trackedRequest.type) && <Bell className="w-7 h-7" />}
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold">{getServiceDisplayName(trackedRequest.type)}</p>
                                        <p className="text-white/60 text-sm">الغرفة {trackedRequest.roomNumber}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="space-y-4">
                                {/* Step 1: Created */}
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="w-0.5 h-8 bg-white/20" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">تم إرسال الطلب</p>
                                        <p className="text-white/50 text-sm">{formatTime(trackedRequest.createdAt)}</p>
                                    </div>
                                </div>

                                {/* Step 2: Confirmed */}
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(trackedRequest.status)
                                            ? 'bg-green-500' : 'bg-white/20'
                                            }`}>
                                            {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(trackedRequest.status)
                                                ? <CheckCircle className="w-5 h-5 text-white" />
                                                : <Clock className="w-5 h-5 text-white/40" />
                                            }
                                        </div>
                                        <div className="w-0.5 h-8 bg-white/20" />
                                    </div>
                                    <div>
                                        <p className={`font-medium ${['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(trackedRequest.status) ? 'text-white' : 'text-white/40'}`}>
                                            تأكيد الاستقبال
                                        </p>
                                        <p className="text-white/50 text-sm">
                                            {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(trackedRequest.status) ? 'تم التأكيد' : 'قيد الانتظار'}
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3: In Progress */}
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${['IN_PROGRESS', 'COMPLETED'].includes(trackedRequest.status)
                                            ? 'bg-blue-500' : 'bg-white/20'
                                            }`}>
                                            {['IN_PROGRESS', 'COMPLETED'].includes(trackedRequest.status)
                                                ? <CheckCircle className="w-5 h-5 text-white" />
                                                : <Clock className="w-5 h-5 text-white/40" />
                                            }
                                        </div>
                                        <div className="w-0.5 h-8 bg-white/20" />
                                    </div>
                                    <div>
                                        <p className={`font-medium ${['IN_PROGRESS', 'COMPLETED'].includes(trackedRequest.status) ? 'text-white' : 'text-white/40'}`}>
                                            جاري التنفيذ
                                        </p>
                                        <p className="text-white/50 text-sm">
                                            {trackedRequest.status === 'IN_PROGRESS' ? 'الموظف في الطريق' : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Step 4: Completed */}
                                <div className="flex items-start gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${trackedRequest.status === 'COMPLETED' ? 'bg-green-500' : 'bg-white/20'
                                        }`}>
                                        {trackedRequest.status === 'COMPLETED'
                                            ? <CheckCircle className="w-5 h-5 text-white" />
                                            : <Clock className="w-5 h-5 text-white/40" />
                                        }
                                    </div>
                                    <div>
                                        <p className={`font-medium ${trackedRequest.status === 'COMPLETED' ? 'text-white' : 'text-white/40'}`}>
                                            مكتمل
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={closeTracker}
                                className="w-full btn-primary py-3 mt-6"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Out of Hours Modal */}
            {outOfHoursService && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center">
                        <div className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                            <Moon className="w-10 h-10 text-yellow-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">خارج أوقات العمل</h2>
                        <p className="text-white/60 mb-6">
                            {outOfHoursService === 'cleaning' ? (
                                <>عذراً، خدمة {getServiceDisplayName(outOfHoursService)} غير متاحة حالياً.<br />يمكنك التواصل مع الاستقبال عبر الواتساب.</>
                            ) : (
                                <>هذه غير أوقات العمل الرسمية لـ {getServiceDisplayName(outOfHoursService)}.<br />هل تريد طلب طارئ؟</>
                            )}
                        </p>
                        
                        {outOfHoursService === 'cleaning' ? (
                            // For cleaning - simple WhatsApp button
                            <>
                                <button
                                    onClick={() => {
                                        const number = branchSettings?.whatsappNumber || '966500000000';
                                        const message = encodeURIComponent(
                                            `مرحباً، أنا نزيل في الغرفة ${session?.roomNumber}، أود طلب خدمة ${getServiceDisplayName(outOfHoursService)}.`
                                        );
                                        window.open(`https://wa.me/${number}?text=${message}`, '_blank');
                                        closeOutOfHoursModal();
                                    }}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 mb-3"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    تواصل عبر واتساب
                                </button>
                                <button onClick={closeOutOfHoursModal} className="w-full text-white/60 py-2">
                                    إغلاق
                                </button>
                            </>
                        ) : (
                            // For maintenance and coffee shop - emergency request option
                            <>
                                <button
                                    onClick={() => openEmergencyModal(outOfHoursService)}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 mb-3"
                                >
                                    <AlertCircle className="w-5 h-5" />
                                    طلب طارئ
                                </button>
                                <button onClick={closeOutOfHoursModal} className="w-full text-white/60 py-2">
                                    إلغاء
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Emergency Request Modal */}
            {showEmergencyModal && emergencyServiceType && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-end" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="w-full bg-slate-900 border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">طلب طارئ</h2>
                                    <p className="text-white/60 text-sm">{getServiceDisplayName(emergencyServiceType)}</p>
                                </div>
                                <button onClick={closeEmergencyModal} className="text-white/60">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Description Input */}
                                {(emergencyServiceType === 'maintenance' || emergencyServiceType === 'coffee' || emergencyServiceType === 'room_service') && (
                                    <div>
                                        <label className="block text-white/60 text-sm mb-2">
                                            {emergencyServiceType === 'maintenance' ? 'وصف المشكلة (اختياري)' : 'ملاحظات (اختياري)'}
                                        </label>
                                        <textarea
                                            value={emergencyNotes}
                                            onChange={(e) => setEmergencyNotes(e.target.value)}
                                            placeholder={emergencyServiceType === 'maintenance' ? 'مثال: التكييف لا يعمل' : 'مثال: طلب خاص'}
                                            rows={3}
                                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white resize-none"
                                        />
                                    </div>
                                )}

                                {/* Photo Upload (for maintenance only) */}
                                {emergencyServiceType === 'maintenance' && (
                                    <div>
                                        <label className="block text-white/60 text-sm mb-2">صورة المشكلة (اختياري)</label>
                                        {emergencyPhoto ? (
                                            <div className="relative">
                                                <img src={emergencyPhoto} className="w-full h-40 object-cover rounded-xl" alt="Emergency" />
                                                <button onClick={removeEmergencyPhoto} className="absolute top-2 right-2 bg-red-500 p-1 rounded-full">
                                                    <X className="w-4 h-4 text-white" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => emergencyPhotoInputRef.current?.click()}
                                                className="w-full py-8 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center gap-2 text-white/40"
                                            >
                                                <Camera className="w-8 h-8" />
                                                <span>التقاط صورة</span>
                                            </button>
                                        )}
                                        <input
                                            ref={emergencyPhotoInputRef}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleEmergencyPhotoUpload}
                                            className="hidden"
                                        />
                                    </div>
                                )}

                                {/* Coffee Shop Cart Display (if items selected) */}
                                {(emergencyServiceType === 'coffee' || emergencyServiceType === 'room_service') && (
                                    <div>
                                        <p className="text-white/60 text-sm mb-2">المنتجات المطلوبة</p>
                                        {Object.keys(coffeeCart).filter(id => coffeeCart[id] > 0).length > 0 ? (
                                            <div className="bg-white/5 rounded-xl p-4 space-y-2">
                                                {Object.entries(coffeeCart)
                                                    .filter(([_, qty]) => qty > 0)
                                                    .map(([id, qty]) => {
                                                        const item = coffeeMenu.find(m => m.id === id);
                                                        return (
                                                            <div key={id} className="flex justify-between text-white">
                                                                <span>{item?.name || id}</span>
                                                                <span>× {qty}</span>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-white/40 text-sm">لم يتم اختيار منتجات بعد</p>
                                                <button
                                                    onClick={() => {
                                                        setShowEmergencyModal(false);
                                                        setShowCoffeeModal(true);
                                                    }}
                                                    className="w-full py-3 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <ShoppingCart className="w-4 h-4" />
                                                    اختيار المنتجات
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* WhatsApp Send Button */}
                                <button
                                    onClick={sendEmergencyWhatsApp}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl flex items-center justify-center gap-2 font-bold"
                                >
                                    <MessageCircle className="w-5 h-5" />
                                    إرسال عبر واتساب إلى الاستقبال
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Menu Modals */}
            {(showCoffeeModal || showMinibarModal) && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-end" style={{ backdropFilter: 'none' }}>
                    {/* ✅ SOLID Modal */}
                    <div className="w-full bg-slate-900 border-t border-white/10 rounded-t-3xl max-h-[80vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white">
                                    {showCoffeeModal ? 'خدمة الغرف' : 'ميني بار'}
                                </h2>
                                <button onClick={() => { setShowCoffeeModal(false); setShowMinibarModal(false); }} className="text-white/60">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {(showCoffeeModal ? coffeeMenu : minibarMenu).map(item => {
                                    const cart = showCoffeeModal ? coffeeCart : minibarCart;
                                    const qty = cart[item.id] || 0;
                                    return (
                                        <div key={item.id} className="glass-card p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{item.icon}</span>
                                                <div>
                                                    <p className="text-white font-medium">{item.name}</p>
                                                    <p className="text-primary-400">{item.price} ر.س</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => updateProductQty(showCoffeeModal ? 'coffee' : 'minibar', item.id, -1)}
                                                    className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center"
                                                >
                                                    <Minus className="w-4 h-4 text-white" />
                                                </button>
                                                <span className="text-white w-6 text-center">{qty}</span>
                                                <button
                                                    onClick={() => updateProductQty(showCoffeeModal ? 'coffee' : 'minibar', item.id, 1)}
                                                    className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center"
                                                >
                                                    <Plus className="w-4 h-4 text-white" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {getCartTotal(showCoffeeModal ? 'coffee' : 'minibar') > 0 && (
                                <div className="mt-6 pt-4 border-t border-white/10">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-white/60">الإجمالي</span>
                                        <span className="text-white font-bold text-xl">
                                            {getCartTotal(showCoffeeModal ? 'coffee' : 'minibar')} ر.س
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => submitProductOrder(showCoffeeModal ? 'coffee' : 'minibar')}
                                        disabled={isSubmitting}
                                        className="w-full btn-primary py-4 disabled:opacity-50"
                                    >
                                        {isSubmitting ? <AdoraLoaderInline size={20} /> : 'إرسال الطلب'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🆕 Quick Issue Reporter */}
            {session && (
                <QuickIssueReporter
                    tenantId={session.hotelId}
                    branchId={session.branch}
                    roomNumber={session.roomNumber}
                    guestPhone={session.guestPhone}
                />
            )}

            {/* 🆕 Smart Chat Widget */}
            {session && (
                <GuestChatWidget
                    tenantId={session.hotelId}
                    branchId={session.branch}
                    roomNumber={session.roomNumber}
                    guestName={session.guestName}
                    guestPhone={session.guestPhone}
                    isDemoMode={isDemoMode} // 🎮 Pass demo mode to chat widget
                />
            )}

            {/* ============================================
                DEVELOPER FOOTER - Professional Single Line
                ============================================ */}
            <footer 
                className="relative z-10 w-full py-4 mt-auto text-center"
                dir="ltr"
            >
                <p 
                    className="text-[8px] sm:text-[9px] tracking-wide transition-all duration-300 flex items-center justify-center gap-1.5 flex-wrap px-4"
                    style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
                >
                    {/* Copyright */}
                    <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                        © {new Date().getFullYear()}
                    </span>
                    <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                    
                    {/* Developer Name */}
                    <span className={`font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                        {(() => {
                            try { return localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda'; } 
                            catch { return 'Ayman Abo Warda'; }
                        })()}
                    </span>
                    <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                    
                    {/* Saudi Phone */}
                    <a 
                        href={`https://wa.me/${(() => {
                            try { return localStorage.getItem('adora_dev_phone_sa') || '966570707121'; } 
                            catch { return '966570707121'; }
                        })()}?text=${encodeURIComponent((() => {
                            const hour = new Date().getHours();
                            return hour >= 5 && hour < 12 ? 'صباح الخير، أنا مهتم بمشروعك' : 'مساء الخير، أنا مهتم بمشروعك';
                        })())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline transition-colors ${
                            isDark 
                                ? 'text-slate-300 hover:text-teal-400' 
                                : 'text-slate-600 hover:text-teal-600'
                        }`}
                    >
                        +{(() => {
                            try { return localStorage.getItem('adora_dev_phone_sa') || '966570707121'; } 
                            catch { return '966570707121'; }
                        })()}
                    </a>
                    <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                    
                    {/* Egypt Phone */}
                    <a 
                        href={`https://wa.me/${(() => {
                            try { return localStorage.getItem('adora_dev_phone_eg') || '201500000162'; } 
                            catch { return '201500000162'; }
                        })()}?text=${encodeURIComponent((() => {
                            const hour = new Date().getHours();
                            return hour >= 5 && hour < 12 ? 'صباح الخير، أنا مهتم بمشروعك' : 'مساء الخير، أنا مهتم بمشروعك';
                        })())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`hover:underline transition-colors ${
                            isDark 
                                ? 'text-slate-300 hover:text-teal-400' 
                                : 'text-slate-600 hover:text-teal-600'
                        }`}
                    >
                        +{(() => {
                            try { return localStorage.getItem('adora_dev_phone_eg') || '201500000162'; } 
                            catch { return '201500000162'; }
                        })()}
                    </a>
                    <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                    
                    {/* Developer Email */}
                    <a 
                        href={`mailto:${(() => {
                            try { return localStorage.getItem('adora_dev_email') || '77aayy@gmail.com'; } 
                            catch { return '77aayy@gmail.com'; }
                        })()}`}
                        className={`hover:underline transition-colors ${
                            isDark 
                                ? 'text-slate-300 hover:text-teal-400' 
                                : 'text-slate-600 hover:text-teal-600'
                        }`}
                    >
                        {(() => {
                            try { return localStorage.getItem('adora_dev_email') || '77aayy@gmail.com'; } 
                            catch { return '77aayy@gmail.com'; }
                        })()}
                    </a>
                </p>
            </footer>

            {/* ============================================
                PREMIUM CSS ANIMATIONS FOR DASHBOARD
                ============================================ */}
            <style>{`
                /* ============================================
                   DASHBOARD PREMIUM BACKGROUND EFFECTS
                   ============================================ */
                
                /* Aurora animated gradient */
                .dashboard-aurora-gradient {
                    background: 
                        linear-gradient(125deg, rgba(20, 184, 166, 0.15) 0%, transparent 40%),
                        linear-gradient(225deg, rgba(6, 182, 212, 0.12) 0%, transparent 40%),
                        linear-gradient(315deg, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
                    animation: dashboardAuroraMove 15s ease-in-out infinite;
                }
                @keyframes dashboardAuroraMove {
                    0%, 100% { opacity: 0.8; transform: scale(1) rotate(0deg); }
                    50% { opacity: 1; transform: scale(1.05) rotate(1deg); }
                }
                
                /* Wave background */
                .dashboard-wave-bg {
                    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%2314b8a6' fill-opacity='0.05' d='M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,202.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E");
                    background-size: cover;
                    background-position: bottom;
                    animation: dashboardWaveMove 8s ease-in-out infinite;
                }
                @keyframes dashboardWaveMove {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(-20px); }
                }
                
                /* Floating orbs - Enhanced */
                .dashboard-orb {
                    border-radius: 50%;
                    filter: blur(60px);
                    animation: dashboardOrbFloat 20s ease-in-out infinite;
                }
                .dashboard-orb-1 {
                    background: radial-gradient(circle, rgba(20, 184, 166, 0.4) 0%, rgba(6, 182, 212, 0.2) 50%, transparent 70%);
                    animation-delay: 0s;
                }
                .dashboard-orb-2 {
                    background: radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(16, 185, 129, 0.15) 50%, transparent 70%);
                    animation-delay: -7s;
                }
                .dashboard-orb-3 {
                    background: radial-gradient(circle, rgba(45, 212, 191, 0.3) 0%, rgba(20, 184, 166, 0.1) 50%, transparent 70%);
                    animation-delay: -14s;
                }
                @keyframes dashboardOrbFloat {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    25% { transform: translate(30px, -20px) scale(1.1); }
                    50% { transform: translate(0, -40px) scale(1); }
                    75% { transform: translate(-30px, -20px) scale(1.1); }
                }
                
                /* Hexagon pattern */
                .dashboard-hex-pattern {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%2314b8a6' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
                }
                
                /* Floating shapes */
                .dashboard-shape {
                    position: absolute;
                    font-size: 24px;
                    color: rgba(20, 184, 166, 0.15);
                    animation: dashboardShapeFloat 15s ease-in-out infinite;
                    pointer-events: none;
                }
                .dashboard-shape-1 { top: 15%; left: 10%; animation-delay: 0s; font-size: 32px; }
                .dashboard-shape-2 { top: 25%; right: 15%; animation-delay: -3s; font-size: 20px; }
                .dashboard-shape-3 { bottom: 35%; left: 8%; animation-delay: -6s; font-size: 28px; }
                .dashboard-shape-4 { top: 55%; right: 12%; animation-delay: -9s; font-size: 16px; }
                .dashboard-shape-5 { bottom: 25%; right: 20%; animation-delay: -12s; font-size: 22px; }
                @keyframes dashboardShapeFloat {
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
                .dashboard-corner-decoration {
                    background: linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, transparent 50%);
                    pointer-events: none;
                }
                .dashboard-corner-tl {
                    border-radius: 0 0 100% 0;
                }
                .dashboard-corner-br {
                    border-radius: 100% 0 0 0;
                    background: linear-gradient(315deg, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
                }
                
                /* Glow pulse animations */
                .dashboard-glow-pulse {
                    animation: dashboardGlowPulse 4s ease-in-out infinite;
                }
                .dashboard-glow-pulse-delay {
                    animation: dashboardGlowPulse 4s ease-in-out infinite 2s;
                }
                @keyframes dashboardGlowPulse {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.15); }
                }
                
                /* ✨ Twinkling stars animation for dark mode */
                .dashboard-star-twinkle {
                    animation: dashboardTwinkle ease-in-out infinite;
                }
                @keyframes dashboardTwinkle {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.5); }
                }
                
                /* 🌠 Shooting star animation */
                .dashboard-shooting-star {
                    animation: dashboardShootingStar 4s ease-out infinite;
                    animation-delay: 3s;
                    box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.8),
                                -100px -100px 20px 0px rgba(255, 255, 255, 0.1);
                }
                @keyframes dashboardShootingStar {
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
            `}</style>
        </div>
    );
};

export default GuestDashboard;
