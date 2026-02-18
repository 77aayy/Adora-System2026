/**
 * Enhanced Owner Dashboard
 * Professional SaaS control panel for system owner
 * Complete control over all system settings, features, and tenants
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Crown, Settings, TrendingUp, Users, Building2, Zap, Building,
    Bell, AlertTriangle, CheckCircle, MessageSquare, DollarSign,
    Activity, Shield, Database, RefreshCw, Save, Plus, X,
    Play, Pause, Eye, Edit2, Trash2, Upload, ChevronDown, Check, DoorOpen, Search, Calendar, Clock,
    LayoutDashboard, CreditCard, BarChart3, Menu, ChevronLeft, ChevronRight, LogOut, Globe, Server, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import {
    getSystemSettings,
    updateSystemSettings,
    toggleFeature,
    setMaintenanceMode,
    addSystemUpdate,
    addBroadcastMessage,
    isFeatureEnabled,
    getActiveBroadcasts,
    isMaintenanceMode,
    cleanExpiredBroadcasts
} from '../../services/systemSettingsService';
import {
    getSystemAnalytics,
    getTenantAnalytics,
    TenantAnalytics
} from '../../services/analyticsService';
import { getAllManagers, createManager, isPinAvailable, suggestUniquePin, toggleLicenseStatus, renewLicense, softDeleteManager, restoreManager, getDeletedManagers, getDemoStats } from '../../services/ownerService';
import { getAllTrialRequests, getDeletedTrialRequests, markTrialRequestAsContacted, addFollowUpToTrialRequest, deleteTrialRequest, type TrialRequest, type DeletedTrialRequest } from '../../services/trialRequestService';
import type { SystemSettings } from '../../services/systemSettingsService';
import { PageTransition } from '../../components/common/PageTransition';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { UnifiedModal, ModalActions } from '../../components/common/UnifiedModal';
import { LineChart, BarChart, DoughnutChart } from '../../components/analytics/ChartComponents';
import { FileText, AlertCircle, Download, Code2, Palette, Printer } from 'lucide-react';
import { useAllBranchesForOwner } from '../../hooks/useTenantData'; // ✅ SaaS Integration
import { clearAllCache as clearRequestCache } from '../../utils/requestCache'; // ✅ For force refresh
import { StatCard } from '../../components/common/StatCard'; // ✅ Use project StatCard
import { DataHealthReportCard } from '../../components/admin/DataHealthReportCard'; // ✅ Data Health Report
import {
    calculateMonthlyRecurringRevenue,
    calculateAnnualRecurringRevenue,
    calculateMonthlyRenewalRevenue,
    getNearestExpiringSubscription,
    getSubscription,
    renewSubscription,
    createInvoice,
    recordPayment,
    getDeletedBillingCount,
    calculateTotalRevenue
} from '../../services/billingService';
import { collection, query, where, getCountFromServer, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { calculateTenantRevenue } from '../../services/billingService';
import { confirm as customConfirm } from '../../services/customConfirmService';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { formatDualDate, formatDateGregorianEn, formatDateTimeGregorianEn } from '../../utils/dateUtils';
import { LicenseNotificationWidget } from '../../components/dashboard/LicenseNotificationWidget';
import { BillingDashboard } from './BillingDashboard'; // ✅ Import for embedded billing tab
import {
    AuditLog,
    fetchActivityLogs,
    forceRefreshActivity,
    isCacheValid,
    getActionLabel,
    getActionIcon,
    getActionColor,
    formatTimeAgo
} from '../../utils/auditService';
import { TenantFirebaseConfig } from '../../components/admin/TenantFirebaseConfig';
import { CoreConfigTemplate } from '../../components/admin/CoreConfigTemplate';
import { FirebaseConfig } from '../../services/firebase';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { CreateManagerHelp } from '../../components/common/ContextualHelp'; // ✅ Contextual Help
// DeveloperSignature is now in GlobalFooter (App.tsx) - no need to import here
import { Sparkles } from 'lucide-react';
import { executeDeepAudit } from '../../services/deepAuditService'; // ✅ Deep Audit & Purge System
import { logger } from '../../services/loggerService'; // ✅ Logger for audit operations
import { haptic, playSound } from '../../utils/uxEffects'; // ✅ UX feedback
// ✅ Onboarding Tour
import { useOnboardingTour } from '../../hooks/useOnboardingTour';
import { TourGuide } from '../../components/shared/TourGuide';
import { MobileMenu } from '../../components/common/MobileMenu';

// ============================================================
// TYPES
// ============================================================

type TabType = 'overview' | 'tenants' | 'settings' | 'billing' | 'core-config' | 'subscription-requests';

// ============================================================
// HELPER: Safe Date Conversion (handles Firestore Timestamps)
// ============================================================
/**
 * Safely convert any date-like value to a JavaScript Date
 * Handles: Firestore Timestamp, Date object, timestamp number, ISO string
 */
const toSafeDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    // Firestore Timestamp
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue?.toDate === 'function') return dateValue.toDate();
    // Already a Date
    if (dateValue instanceof Date) return dateValue;
    // Timestamp number or ISO string
    return new Date(dateValue);
};

// ============================================================
// LOCAL STORAGE CACHE - Persistent across page reloads
// ============================================================
const CACHE_KEY_PREFIX = 'adora_owner_cache_';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour - owner data doesn't need frequent updates

type CacheKey = 'analytics' | 'tenants' | 'multiBranch' | 'settings' | 'managerStats' | 'revenue';

/**
 * Get cached data from localStorage
 * Returns null if expired or not found
 */
const getCachedData = (key: CacheKey): any => {
    try {
        const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                logger.debug(`📦 Cache HIT: ${key} (saved ${Math.round((Date.now() - timestamp) / 1000)}s ago)`, undefined, 'EnhancedOwnerDashboard');
                return data;
            }
            logger.debug(`📦 Cache EXPIRED: ${key}`, undefined, 'EnhancedOwnerDashboard');
        }
    } catch (e) {
        logger.warn('Cache read error:', e, 'EnhancedOwnerDashboard');
    }
    return null;
};

/**
 * Save data to localStorage cache
 */
const setCachedData = (key: CacheKey, data: any): void => {
    try {
        localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
        logger.debug(`💾 Cache SAVED: ${key}`, undefined, 'EnhancedOwnerDashboard');
    } catch (e) {
        logger.warn('Cache write error:', e, 'EnhancedOwnerDashboard');
    }
};

// ============================================================
// ADD MANAGER DRAFT - Restore wizard after refresh
// ============================================================
const ADD_MANAGER_DRAFT_KEY = 'adora_add_manager_draft';

export type AddManagerDraft = {
    currentStep: number;
    name: string;
    phone: string;
    phoneBackup: string;
    code: string;
    hotelName: string;
    branchCodes: Array<{ code: string; name: string }>;
    subscriptionDuration: 1 | 2;
    paymentMethod: string;
    firebaseConfig: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId?: string;
        appId?: string;
    };
};

export const getAddManagerDraft = (): AddManagerDraft | null => {
    try {
        const raw = sessionStorage.getItem(ADD_MANAGER_DRAFT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as AddManagerDraft;
        if (parsed && typeof parsed.currentStep === 'number' && parsed.currentStep >= 1 && parsed.currentStep <= 4) {
            return parsed;
        }
    } catch (_) { /* ignore */ }
    return null;
};

export const setAddManagerDraft = (draft: AddManagerDraft): void => {
    try {
        sessionStorage.setItem(ADD_MANAGER_DRAFT_KEY, JSON.stringify(draft));
    } catch (_) { /* ignore */ }
};

export const clearAddManagerDraft = (): void => {
    try {
        sessionStorage.removeItem(ADD_MANAGER_DRAFT_KEY);
    } catch (_) { /* ignore */ }
};

/**
 * Clear all owner dashboard cache (for logout or force refresh)
 */
const clearOwnerCache = (): void => {
    const keys: CacheKey[] = ['analytics', 'tenants', 'multiBranch', 'settings', 'managerStats', 'revenue'];
    keys.forEach(key => {
        localStorage.removeItem(CACHE_KEY_PREFIX + key);
    });
    logger.info('🗑️ Owner cache cleared', undefined, 'EnhancedOwnerDashboard');
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const EnhancedOwnerDashboard: React.FC = () => {
    const { success, error } = useUX();
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { t } = useTranslation();

    // ✅ SaaS Integration: Get all branches dynamically
    // ✅ Memoize to prevent unnecessary re-renders
    const { branches: allBranches, loading: branchesLoading } = useAllBranchesForOwner();
    const memoizedBranches = useMemo(() => allBranches, [allBranches.length]); // ✅ Only re-compute if length changes

    // ✅ Read active tab from URL (synced with navbar)
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') || 'overview') as TabType;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingHeavyData, setLoadingHeavyData] = useState(false);
    
    // ✅ Mobile Menu State
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    // ✅ Sidebar collapse state — لزامن هامش المحتوى مع عرض الشريط
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // ✅ Close mobile menu when screen size changes to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024 && showMobileMenu) {
                setShowMobileMenu(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showMobileMenu]);

    // System Settings State
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
    
    // ✅ Core Config Access Control
    const [showCoreConfigModal, setShowCoreConfigModal] = useState(false);
    const [coreConfigPassword, setCoreConfigPassword] = useState('');
    const [coreConfigAccessGranted, setCoreConfigAccessGranted] = useState(false);
    
    // ✅ Get visible tabs configuration (default: only show non-duplicated tabs)
    // ✅ CRITICAL: Must be defined AFTER systemSettings state
    const visibleTabs = systemSettings?.visibleTabs || {
        overview: true,      // الرئيسية - always visible
        tenants: false,      // المشتركين - in sidebar, hide by default
        billing: false,      // الفواتير - in sidebar, hide by default
        settings: false,     // الإعدادات - in sidebar, hide by default
        broadcasts: false,   // الرسائل - in sidebar, hide by default
        'core-config': false // التأسيس - in sidebar, hide by default
    };
    const [analytics, setAnalytics] = useState<any>(null);

    // ✅ Auto-show password modal when core-config tab is accessed
    useEffect(() => {
        if (activeTab === 'core-config' && !coreConfigAccessGranted && !showCoreConfigModal) {
            setShowCoreConfigModal(true);
            setCoreConfigPassword('');
        }
    }, [activeTab, coreConfigAccessGranted, showCoreConfigModal]);
    const [tenants, setTenants] = useState<TenantAnalytics[]>([]);

    // Revenue & Subscription Data
    const [mrr, setMrr] = useState(0);
    const [arr, setArr] = useState(0);
    const [monthlyRenewalRevenue, setMonthlyRenewalRevenue] = useState(0);
    const [nearestExpiring, setNearestExpiring] = useState<{
        subscription: any;
        daysUntilExpiry: number;
        branchName?: string;
        tenantName?: string;
    } | null>(null);

    // Multi-Branch Data (from MultiBranchDashboard)
    const [multiBranchData, setMultiBranchData] = useState<{
        totalUsers: number;
        totalRequests: number;
        totalRooms: number;
        revenue: number;
    } | null>(null);

    // ✅ Manager Status Stats (Active, Suspended, Deleted, Expired)
    const [managerStats, setManagerStats] = useState<{
        active: number;
        suspended: number;
        deleted: number;
        expired: number;
        total: number;
    }>({ active: 0, suspended: 0, deleted: 0, expired: 0, total: 0 });
    
    // ✅ Billing Deleted Count (invoices + vouchers)
    const [deletedBillingCount, setDeletedBillingCount] = useState(0);
    
    // ✅ Total Revenue (all invoices, not just paid)
    const [totalRevenue, setTotalRevenue] = useState(0);

    // ✅ Live Activity Feed (On-demand updates only)
    const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);

    // ✅ Demo Stats (separate from main stats)
    const [demoStats, setDemoStats] = useState<{
        total: number;
        nearestExpiry: Date | null;
        farthestExpiry: Date | null;
    }>({ total: 0, nearestExpiry: null, farthestExpiry: null });

    // ✅ Progressive Loading: Show "data updated" indicator
    const [dataJustUpdated, setDataJustUpdated] = useState(false);
    const [backgroundLoading, setBackgroundLoading] = useState(false);

    // Modals
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [showFeatureModal, setShowFeatureModal] = useState(false);
    const [showAddManagerModal, setShowAddManagerModal] = useState(() => {
        return getAddManagerDraft() !== null;
    });
    const [showManagerDetailsModal, setShowManagerDetailsModal] = useState(false);
    const [selectedManager, setSelectedManager] = useState<TenantAnalytics | null>(null);

    // Sidebar
    const [showSidebar, setShowSidebar] = useState(false);

    // ✅ Onboarding Tour for Owner Dashboard
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('owner');

    const loadDataRef = useRef(false); // ✅ Prevent multiple simultaneous loads
    const loadDataCalledRef = useRef(false); // ✅ Track if loadData was called
    const [subscriptionTabRefreshKey, setSubscriptionTabRefreshKey] = useState(0); // ✅ Remount SubscriptionRequestsTab on header refresh so list refetches

    useEffect(() => {
        // ✅ CRITICAL FIX: Don't attempt Firestore recovery here
        // Recovery causes "INTERNAL ASSERTION FAILED" when listeners are active
        // Errors are handled globally in errorHandlerService.ts (auto-reload)
        
        // ✅ Only call loadData once on mount
        if (!loadDataCalledRef.current) {
            loadDataCalledRef.current = true;
            loadData();
        }

        // ✅ FAST UI: إظهار الهيكل بعد 0.35 ثانية كحد أقصى — الباقي يحمّل في الخلفية
        const fastUITimeout = setTimeout(() => {
            setLoading((prev) => {
                if (prev) {
                    setBackgroundLoading(true);
                    return false;
                }
                return prev;
            });
        }, 350);

        // ✅ AUTO-STOP: إيقاف شريط الخلفية بعد 8 ثوان (تغطية حالات الخطأ)
        const bgLoadingTimeout = setTimeout(() => {
            setBackgroundLoading(false);
            setLoadingHeavyData(false);
        }, 8000);

        return () => {
            clearTimeout(fastUITimeout);
            clearTimeout(bgLoadingTimeout);
        };
    }, []); // ✅ Empty deps - only run once

    // ✅ Auto-show password modal when core-config tab is accessed (from sidebar or URL)
    useEffect(() => {
        if (activeTab === 'core-config' && !coreConfigAccessGranted && !showCoreConfigModal) {
            setShowCoreConfigModal(true);
            setCoreConfigPassword('');
        }
    }, [activeTab, coreConfigAccessGranted, showCoreConfigModal]);

    // ✅ Fetch activity when entering overview tab (ON-DEMAND only, no real-time)
    // 🔥 SAVES FIREBASE QUOTA: Only fetches on page load/refresh, manual refresh button available
    useEffect(() => {
        if (activeTab === 'overview') {
            // ✅ Fetch once when opening overview tab (uses cache if available)
            fetchActivityLogs(false).then(({ logs }) => {
                setActivityLogs(logs);
            }).catch(err => {
                logger.error('Failed to fetch activity logs:', err, 'EnhancedOwnerDashboard');
                setActivityLogs([]);
            });

            // ✅ Load demo stats separately (doesn't affect main calculations)
            loadDemoStats();
        }
    }, [activeTab]);

    // ✅ Load demo stats separately (doesn't affect main calculations)
    // ✅ FIX: Uses service function - follows architecture rules
    const loadDemoStats = async () => {
        try {
            const stats = await getDemoStats();
            setDemoStats(stats);
        } catch (err) {
            logger.error('Failed to load demo stats:', err, 'EnhancedOwnerDashboard');
            setDemoStats({ total: 0, nearestExpiry: null, farthestExpiry: null });
        }
    };

    const loadData = async (forceRefresh: boolean = false) => {
        // ✅ Prevent multiple simultaneous loads
        if (loadDataRef.current) {
            logger.debug('⏸️ loadData already in progress, skipping...', undefined, 'EnhancedOwnerDashboard');
            return;
        }

        loadDataRef.current = true;
        logger.debug(forceRefresh ? '🔄 Force refresh requested' : '📦 Loading with cache...', undefined, 'EnhancedOwnerDashboard');

        // ✅ CRITICAL FIX: Don't attempt Firestore recovery here
        // Recovery causes "INTERNAL ASSERTION FAILED" when listeners are active
        // Errors are handled globally in errorHandlerService.ts (auto-reload)

        // ✅ FIX: Clear ALL caches when force refresh requested
        if (forceRefresh) {
            logger.info('🗑️ Clearing all cached data...', undefined, 'EnhancedOwnerDashboard');
            // Clear localStorage cache
            localStorage.removeItem(CACHE_KEY_PREFIX + 'settings');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'analytics');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'revenue');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'tenants');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'multiBranch');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'managerStats');
            // Clear in-memory request cache
            clearRequestCache();
            // Clear recovery flag to allow retry
            sessionStorage.removeItem('adora_firestore_recovery_attempted');
        }

        // ✅ PHASE 0: Show cached data IMMEDIATELY (instant UI)
        if (!forceRefresh) {
            const cachedSettings = getCachedData('settings');
            const cachedAnalytics = getCachedData('analytics');
            const cachedRevenue = getCachedData('revenue');
            const cachedTenants = getCachedData('tenants');
            const cachedMultiBranch = getCachedData('multiBranch');
            const cachedManagerStats = getCachedData('managerStats');

            // Apply cached data immediately - user sees page instantly!
            // ✅ FIX: Only set tenants if cache is NOT empty (prevent empty array from blocking data load)
            if (cachedSettings) setSystemSettings(cachedSettings);
            if (cachedAnalytics) setAnalytics(cachedAnalytics);
            if (cachedTenants && Array.isArray(cachedTenants) && cachedTenants.length > 0) {
                setTenants(cachedTenants);
            }
            if (cachedMultiBranch) setMultiBranchData(cachedMultiBranch);
            if (cachedManagerStats) setManagerStats(cachedManagerStats);
            if (cachedRevenue) {
                setMrr(cachedRevenue.mrr || 0);
                setArr(cachedRevenue.arr || 0);
                setMonthlyRenewalRevenue(cachedRevenue.monthlyRenewal || 0);
                setNearestExpiring(cachedRevenue.nearestExpiring || null);
            }

            // ✅ FIX: Only use cache if it's NOT empty (prevent empty cache from blocking data load)
            // If we have all cached data AND tenants array is not empty, stop loading immediately
            const hasValidCache = cachedSettings && cachedAnalytics && cachedTenants && Array.isArray(cachedTenants) && cachedTenants.length > 0;
            if (hasValidCache) {
                logger.info('✅ All data from cache - showing page instantly', undefined, 'EnhancedOwnerDashboard');
                setLoading(false);
                loadDataRef.current = false;

                // Still fetch fresh data in background (silent update)
                setBackgroundLoading(true);
                fetchFreshDataInBackground();
                return;
            } else if (cachedTenants && Array.isArray(cachedTenants) && cachedTenants.length === 0) {
                // ✅ FIX: If cache exists but is empty, clear it and load fresh data
                logger.warn('⚠️ Cache exists but is empty - clearing and loading fresh data', undefined, 'EnhancedOwnerDashboard');
                localStorage.removeItem(CACHE_KEY_PREFIX + 'tenants');
                // Continue to load fresh data below
            }
        }

        // ✅ PHASE 1: Fetch fresh data from Firebase (once per page load or refresh)
        try {
            const [settings, analyticsData] = await Promise.all([
                getSystemSettings().catch(() => null),
                getSystemAnalytics().catch(() => null)
            ]);

            if (settings) {
                setSystemSettings(settings);
                setCachedData('settings', settings);
            }
            if (analyticsData) {
                setAnalytics(analyticsData);
                setCachedData('analytics', analyticsData);
            }

            // ✅ PHASE 2: Load revenue data
            const [monthlyRev, annualRev, renewalRev, nearest, totalRev] = await Promise.all([
                calculateMonthlyRecurringRevenue().catch(() => 0),
                calculateAnnualRecurringRevenue().catch(() => 0),
                calculateMonthlyRenewalRevenue().catch(() => 0),
                getNearestExpiringSubscription().catch(() => null),
                calculateTotalRevenue().catch(() => 0) // ✅ FIX: Calculate total revenue from ALL invoices
            ]);

            setMrr(monthlyRev);
            setArr(annualRev);
            setMonthlyRenewalRevenue(renewalRev);
            setNearestExpiring(nearest);
            setTotalRevenue(totalRev); // ✅ FIX: Set total revenue

            // Cache revenue data
            setCachedData('revenue', {
                mrr: monthlyRev,
                arr: annualRev,
                monthlyRenewal: renewalRev,
                nearestExpiring: nearest
            });

        } catch (err: any) {
            logger.error('Error loading data:', err, 'EnhancedOwnerDashboard');
        } finally {
            setLoading(false);
            loadDataRef.current = false;

            // Show "updated" indicator if this was a refresh
            if (forceRefresh || backgroundLoading) {
                setBackgroundLoading(false);
                setDataJustUpdated(true);
                setTimeout(() => setDataJustUpdated(false), 3000);
            }
            // ✅ When user clicks header "تحديث", remount SubscriptionRequestsTab so it refetches trial requests (one refresh for whole page)
            if (forceRefresh) {
                setSubscriptionTabRefreshKey((k) => k + 1);
            }
        }

        // ✅ PHASE 3: Load heavy data in background
        logger.debug('🔍 [loadData] PHASE 3: Checking if should load heavy data...', { loadingHeavyData }, 'EnhancedOwnerDashboard');
        if (!loadingHeavyData) {
            logger.debug('✅ [loadData] PHASE 3: Calling loadHeavyDataInBackground...', undefined, 'EnhancedOwnerDashboard');
            loadHeavyDataInBackground();
        } else {
            logger.debug('⏸️ [loadData] PHASE 3: Skipping - already loading heavy data', undefined, 'EnhancedOwnerDashboard');
        }
    };

    // ✅ Background data fetcher - runs silently without blocking UI
    const fetchFreshDataInBackground = async () => {
        try {
            // Settings & Analytics
            const [settings, analyticsData] = await Promise.all([
                getSystemSettings().catch(() => null),
                getSystemAnalytics().catch(() => null)
            ]);

            if (settings) {
                setSystemSettings(settings);
                setCachedData('settings', settings);
            }
            if (analyticsData) {
                setAnalytics(analyticsData);
                setCachedData('analytics', analyticsData);
            }

            // Revenue
            const [monthlyRev, annualRev, renewalRev, nearest, totalRev] = await Promise.all([
                calculateMonthlyRecurringRevenue().catch(() => 0),
                calculateAnnualRecurringRevenue().catch(() => 0),
                calculateMonthlyRenewalRevenue().catch(() => 0),
                getNearestExpiringSubscription().catch(() => null),
                calculateTotalRevenue().catch(() => 0) // ✅ FIX: Calculate total revenue
            ]);

            setMrr(monthlyRev);
            setArr(annualRev);
            setMonthlyRenewalRevenue(renewalRev);
            setNearestExpiring(nearest);
            setTotalRevenue(totalRev); // ✅ FIX: Set total revenue
            setCachedData('revenue', { mrr: monthlyRev, arr: annualRev, monthlyRenewal: renewalRev, nearestExpiring: nearest, totalRevenue: totalRev });

            // Heavy data
            await loadHeavyDataInBackground();

        } catch (err) {
            logger.warn('Background refresh error:', err, 'EnhancedOwnerDashboard');
        } finally {
            setBackgroundLoading(false);
            setDataJustUpdated(true);
            setTimeout(() => setDataJustUpdated(false), 3000);
        }
    };

    // ✅ Load manager status statistics
    const loadManagerStats = async () => {
        try {
            const managers = await getAllManagers();
            const deletedManagers = await getDeletedManagers().catch(() => []);

            let active = 0;
            let suspended = 0;
            let expired = 0;
            
            // ✅ DEBUG: Log manager details for troubleshooting
            logger.debug('📊 [ManagerStats] Total managers found:', managers.length, 'EnhancedOwnerDashboard');
            logger.debug('📊 [ManagerStats] Deleted managers:', deletedManagers.length, 'EnhancedOwnerDashboard');
            
            const managerDetails: any[] = [];
            
            managers.forEach((m: any) => {
                const status = m.status || 'active';
                const isDeleted = m.isDeleted === true || m.deletedAt;
                const hasTenantId = m.tenantId && typeof m.tenantId === 'string' && m.tenantId.trim();

                // ✅ DEBUG: Collect manager info for logging
                managerDetails.push({
                    id: m.id,
                    name: m.name,
                    code: m.code,
                    status,
                    isDeleted,
                    hasTenantId: !!hasTenantId,
                    tenantId: m.tenantId
                });

                if (isDeleted) {
                    logger.warn(`⚠️ [ManagerStats] Manager ${m.name} (${m.code}) is marked as deleted but still in main list. Consider running softDeleteManager().`, undefined, 'EnhancedOwnerDashboard');
                    return; // Skip soft-deleted in main list
                }

                if (status === 'active') active++;
                else if (status === 'suspended') suspended++;
                else if (status === 'expired' || status === 'inactive') expired++;
            });
            
            // ✅ DEBUG: Log manager breakdown
            logger.debug('📊 [ManagerStats] Breakdown:', {
                active,
                suspended,
                expired,
                deleted: deletedManagers.length,
                totalInMainList: managers.length
            });
            logger.debug('📊 [ManagerStats] Manager details:', managerDetails, 'EnhancedOwnerDashboard');

            // ✅ FIX: Include deleted billing documents (invoices + vouchers) in deleted count
            const deletedBilling = await getDeletedBillingCount().catch(() => 0);
            const totalDeleted = deletedManagers.length + deletedBilling;

            const stats = {
                active,
                suspended,
                deleted: totalDeleted, // ✅ Now includes managers + billing documents
                expired,
                total: active + suspended + expired + totalDeleted
            };

            setManagerStats(stats);
            setDeletedBillingCount(deletedBilling);
            setCachedData('managerStats', stats); // ✅ Cache locally
        } catch (err) {
            logger.warn('Error loading manager stats:', err, 'EnhancedOwnerDashboard');
        }
    };

    // ✅ Load heavy data in background (non-blocking) - WITH CACHING
    const loadHeavyDataInBackground = async () => {
        logger.debug('🚀 [loadHeavyDataInBackground] Starting...', undefined, 'EnhancedOwnerDashboard');
        // ✅ PERFORMANCE: Check cache first
        const cachedTenants = getCachedData('tenants');
        const cachedMultiBranch = getCachedData('multiBranch');
        const cachedTenantsLength = Array.isArray(cachedTenants) ? cachedTenants.length : (cachedTenants ? 'not array' : 'null/undefined');
        logger.debug('🔍 [loadHeavyDataInBackground] Cache check:', 
            'hasCachedTenants:', !!cachedTenants, 
            'cachedTenantsLength:', cachedTenantsLength,
            'hasCachedMultiBranch:', !!cachedMultiBranch
        );

        // ✅ FIX: Only use cache if it's NOT empty (prevent empty cache from blocking data load)
        const hasValidTenantsCache = cachedTenants && Array.isArray(cachedTenants) && cachedTenants.length > 0;
        logger.debug('🔍 [loadHeavyDataInBackground] hasValidTenantsCache:', { hasValidTenantsCache, cachedMultiBranch: !!cachedMultiBranch }, 'EnhancedOwnerDashboard');
        if (hasValidTenantsCache && cachedMultiBranch) {
            logger.info('✅ [loadHeavyDataInBackground] Using cached data - skipping Firebase', undefined, 'EnhancedOwnerDashboard');
            setTenants(cachedTenants);
            setMultiBranchData(cachedMultiBranch);
            loadManagerStats(); // ✅ Still load manager stats for accurate counts
            return; // Use cached data, skip Firebase
        } else if (cachedTenants && Array.isArray(cachedTenants) && cachedTenants.length === 0) {
            // ✅ FIX: If cache exists but is empty, clear it and load fresh data
            logger.warn('⚠️ [loadHeavyDataInBackground] Cache exists but is empty - clearing and loading fresh data', undefined, 'EnhancedOwnerDashboard');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'tenants');
        } else {
            logger.debug('🔄 [loadHeavyDataInBackground] No valid cache - will load from Firebase', undefined, 'EnhancedOwnerDashboard');
        }

        setLoadingHeavyData(true);
        try {
            // ✅ FIX: Always load fresh data if cache is empty or invalid
            const hasValidTenantsCache = cachedTenants && Array.isArray(cachedTenants) && cachedTenants.length > 0;
            
            // Load tenant analytics, multi-branch data, and manager stats in parallel - with error handling
            const [tenantAnalytics] = await Promise.all([
                !hasValidTenantsCache ? getTenantAnalytics().catch((err: any) => {
                    logger.error('❌ [loadHeavyDataInBackground] Error loading tenant analytics:', err, 'EnhancedOwnerDashboard');
                    if (err?.code === 'resource-exhausted') return [];
                    return [];
                }) : Promise.resolve(cachedTenants),
                !cachedMultiBranch ? loadMultiBranchData().catch(() => { }) : Promise.resolve(),
                loadManagerStats() // ✅ Load manager statistics
            ]);

            // ✅ FIX: Always update state if we got data (even if from cache, to ensure state is set)
            if (tenantAnalytics && Array.isArray(tenantAnalytics)) {
                if (tenantAnalytics.length > 0) {
                    setTenants(tenantAnalytics);
                    setCachedData('tenants', tenantAnalytics);
                    logger.info(`✅ [loadHeavyDataInBackground] Loaded ${tenantAnalytics.length} tenants`, undefined, 'EnhancedOwnerDashboard');
                } else {
                    logger.warn('⚠️ [loadHeavyDataInBackground] No tenants found - array is empty', undefined, 'EnhancedOwnerDashboard');
                    // Don't cache empty arrays - clear cache instead
                    localStorage.removeItem(CACHE_KEY_PREFIX + 'tenants');
                }
            }
        } catch (err: any) {
            // Silent fail for background loading
        } finally {
            setLoadingHeavyData(false);

            // ✅ Show "data updated" pulse when background loading completes
            setDataJustUpdated(true);
            setTimeout(() => setDataJustUpdated(false), 3000);
        }
    };

    // ✅ Load multi-branch aggregated data - SIMPLIFIED & CACHED
    const loadMultiBranchData = async () => {
        // ✅ PERFORMANCE: Check cache first
        const cachedMultiBranch = getCachedData('multiBranch');
        if (cachedMultiBranch) {
            setMultiBranchData(cachedMultiBranch);
            return;
        }

        try {
            const managers = await getAllManagers();

            // ✅ FIX: Filter out deleted, suspended, and expired managers for accurate stats
            // Only count ACTIVE managers with valid licenses
            const activeManagers = managers.filter(m => {
                if (!m.tenantId) return false;
                if ((m as any).isDeleted === true || (m as any).deletedAt) return false;
                const status = (m as any).status || 'active';
                if (status === 'suspended' || status === 'inactive' || status === 'expired') return false;
                return true;
            });

            // ✅ PERFORMANCE: Use ESTIMATED counts from manager info instead of N queries
            // This avoids the heavy getCountFromServer calls that cause quota exhaustion
            const aggregated = activeManagers
                .reduce((acc, manager: any) => ({
                    totalUsers: acc.totalUsers + (manager.cachedStats?.totalUsers || 5), // Estimate
                    totalRequests: acc.totalRequests + (manager.cachedStats?.totalRequests || 0),
                    totalRooms: acc.totalRooms + (manager.cachedStats?.totalRooms || 10), // Estimate
                    revenue: acc.revenue + (manager.cachedStats?.revenue || 0)
                }), { totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 });

            // Cache and set
            setCachedData('multiBranch', aggregated);
            setMultiBranchData(aggregated);

        } catch (error: any) {
            // Silent fail - use defaults
            const defaultData = { totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 };
            setMultiBranchData(defaultData);
        }
    };

    // ✅ LEGACY: Heavy data loader (only called when explicitly refreshing)
    const loadMultiBranchDataHeavy = async () => {
        try {
            const managers = await getAllManagers();

            // ✅ Process in batches of 3 to avoid quota exhaustion
            const BATCH_SIZE = 3;
            let aggregated = { totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 };

            const validManagers = managers.filter(m => m.tenantId);
            for (let i = 0; i < validManagers.length; i += BATCH_SIZE) {
                const batch = validManagers.slice(i, i + BATCH_SIZE);

                const batchResults = await Promise.all(batch.map(async (manager) => {
                    const tenantId = manager.tenantId!;
                    try {
                        // Single batch of queries per tenant
                        if (!db) {
                            return { users: 0, requests: 0, rooms: 0, revenue: 0 };
                        }
                        // ✅ FIX: Use tenant-scoped collections
                        const [usersCount, requestsCount] = await Promise.all([
                            getCountFromServer(query(collection(db, 'users'), where('tenantId', '==', tenantId))).catch(() => ({ data: () => ({ count: 0 }) })),
                            getCountFromServer(query(collection(db, `tenants/${tenantId}/requests`))).catch(() => ({ data: () => ({ count: 0 }) }))
                        ]);

                        return {
                            users: usersCount.data().count,
                            requests: requestsCount.data().count,
                            rooms: 0, // Skip room queries to reduce load
                            revenue: 0
                        };
                    } catch {
                        return { users: 0, requests: 0, rooms: 0, revenue: 0 };
                    }
                }));

                batchResults.forEach(result => {
                    aggregated.totalUsers += result.users;
                    aggregated.totalRequests += result.requests;
                    aggregated.totalRooms += result.rooms;
                    aggregated.revenue += result.revenue;
                });

                // Small delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < validManagers.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            setCachedData('multiBranch', aggregated);
            setMultiBranchData(aggregated);
        } catch {
            setMultiBranchData({ totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 });
        }
    };


    const handleToggleFeature = async (featureKey: keyof SystemSettings['features'], enabled: boolean) => {
        setSaving(true);
        try {
            await toggleFeature(featureKey, enabled, user?.id || 'system');

            // ✅ Update local state immediately (no page reload needed)
            if (systemSettings) {
                setSystemSettings({
                    ...systemSettings,
                    features: {
                        ...(systemSettings.features ?? {}),
                        [featureKey]: enabled
                    }
                });
            }

            // ✅ Cleanup feature data when disabled
            if (!enabled) {
                try {
                    const { cleanupFeatureForAllTenants } = await import('../../services/featureCleanupService');
                    await cleanupFeatureForAllTenants(featureKey);
                    logger.info(`✅ Cleaned up data for disabled feature: ${featureKey}`, undefined, 'EnhancedOwnerDashboard');
                } catch (cleanupError) {
                    logger.warn(`⚠️ Cleanup failed for ${featureKey}:`, cleanupError, 'EnhancedOwnerDashboard');
                    // Don't block the toggle if cleanup fails
                }
            }

            // ✅ FIX: Invalidate cache first, then dispatch event
            try {
                const { invalidateCache } = await import('../../utils/requestCache');
                invalidateCache('settings:system');
            } catch (err) {
                logger.warn('Could not invalidate cache:', err, 'EnhancedOwnerDashboard');
            }

            // ✅ FIX: Dispatch event to notify all components using useFeatureGate
            window.dispatchEvent(new CustomEvent('adora_feature_toggled', {
                detail: { featureKey, enabled }
            }));

            // ✅ No need to reload all data - just update the feature state
            // Components using useFeatureGate will automatically re-check and hide/show
            success(t('admin.featureEnabled', { 
                action: enabled ? t('admin.featureEnabledAction') : t('admin.featureDisabledAction'),
                hidden: !enabled ? t('admin.featureHiddenNote') : ''
            }));
        } catch (err: any) {
            error(t('admin.errorUpdatingFeature'));
            // ✅ Rollback on error
            if (systemSettings) {
                setSystemSettings({
                    ...systemSettings,
                    features: {
                        ...(systemSettings.features ?? {}),
                        [featureKey]: !enabled
                    }
                });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleMaintenanceMode = async (enabled: boolean, message?: string) => {
        setSaving(true);
        try {
            await setMaintenanceMode(enabled, message, user?.id);
            await loadData(true); // Force refresh after change
            success(enabled ? t('admin.maintenanceEnabled') : t('admin.maintenanceDisabled'));
        } catch (err: any) {
            error(t('admin.errorUpdatingMaintenance'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSettings = async (updates: Partial<SystemSettings>) => {
        setSaving(true);
        try {
            await updateSystemSettings(updates, user?.id || 'system');

            // ✅ Update local state immediately (no page reload needed)
            if (systemSettings) {
                const updatedSettings = {
                    ...systemSettings,
                    ...updates
                };
                setSystemSettings(updatedSettings);

                // ✅ FIX: Update BOTH caches so settings persist on refresh
                setCachedData('settings', updatedSettings);

                // ✅ Also update the system localStorage directly (synced with systemSettingsService)
                const localKey = 'adora_system_settings';
                const localData = localStorage.getItem(localKey);
                const existing = localData ? JSON.parse(localData) : {};
                localStorage.setItem(localKey, JSON.stringify({ ...existing, ...updates, updatedAt: new Date().toISOString() }));
            }

            success(t('admin.settingsSaved'));
        } catch (err: any) {
            error(t('admin.errorSavingSettings'));
        } finally {
            setSaving(false);
        }
    };

    /* ✅ No full-screen loading bar: dashboard shows immediately, status dot indicates loading */

    // ✅ Handle Core Config Access — كلمة المرور: ADORA2026
    const handleCoreConfigAccess = () => {
        if (coreConfigPassword.trim() === 'ADORA2026') {
            setCoreConfigAccessGranted(true);
            setShowCoreConfigModal(false);
            setCoreConfigPassword('');
            setSearchParams({ tab: 'core-config' });
            success(t('admin.configModeAccessGranted'));
        } else {
            error(t('admin.wrongPassword'));
        }
    };

    // ✅ Use default settings if not loaded yet (Progressive Loading)
    const defaultFeatures = {
        qrCodeGuestPortal: true,
        pointsSystem: true,
        gamification: true,
        shiftNotes: true,
        scheduledTasks: true,
        aiAssistant: true,
        calendarSync: true,
        inventoryManagement: true,
        procurementSystem: true,
        laundryManagement: true,
        whatsappIntegration: true,
        emailNotifications: true,
        smsNotifications: false,
        experimentalFeatures: {} as Record<string, boolean>,
    };
    const effectiveSettings = (systemSettings || {
        systemVersion: '2.0.0',
        maintenanceMode: false,
        maintenanceMessage: '',
        features: defaultFeatures,
        defaultLanguage: 'ar',
        availableLanguages: ['ar', 'en'],
        defaultTheme: 'light',
        availableThemes: ['light', 'dark'],
        maxBranchesPerTenant: 10,
        subscriptionPrice: 5000,
        trialPeriodDays: 14,
        broadcastMessages: [],
    }) as SystemSettings;
    // ✅ Ensure features is never undefined (defensive for partial loads)
    const safeFeatures = effectiveSettings.features ?? defaultFeatures;

    return (
        <PageTransition>
            {/* ✅ Schedulers are already in GlobalServicesProvider - no need to duplicate */}
            <div
                className="flex transition-colors duration-300"
                style={{ 
                    background: 'var(--theme-gradient-page)',
                    minHeight: '100vh',
                    width: '100%',
                    position: 'relative'
                }}
            >
                {/* ✅ DESKTOP SIDEBAR - Hidden on mobile (STRICT: Never show on mobile) */}
                <div className="hidden lg:block desktop-sidebar-container flex-shrink-0 fixed top-0 right-0 h-screen z-30">
                    <aside id="admin-sidebar" className="h-full">
                        <AdminSidebar 
                            isOwner={user?.role === 'owner'}
                            onCollapseChange={setSidebarCollapsed}
                        />
                    </aside>
                </div>

                {/* ✅ MOBILE SIDEBAR DRAWER - Shows on mobile only (STRICT: Only on mobile) */}
                {showMobileMenu && (
                    <div className="lg:hidden fixed inset-0 z-[60]">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 transition-opacity duration-300"
                            style={{ 
                                background: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(4px)',
                                animation: 'fadeIn 0.3s ease-out'
                            }}
                            onClick={() => setShowMobileMenu(false)}
                        />
                        {/* Sidebar Container - Slides from right */}
                        <div 
                            className="absolute top-0 right-0 h-full w-80 max-w-[85vw] shadow-2xl"
                            style={{
                                background: 'var(--theme-bg-secondary)',
                                borderLeft: '1px solid var(--theme-border-primary)',
                                animation: 'slideInFromRight 0.3s ease-out',
                                transform: 'translateX(0)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <AdminSidebar 
                                isOwner={user?.role === 'owner'}
                                onClose={() => setShowMobileMenu(false)}
                            />
                        </div>
                        <style>{`
                            @keyframes fadeIn {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                            @keyframes slideInFromRight {
                                from { transform: translateX(100%); }
                                to { transform: translateX(0); }
                            }
                        `}</style>
                    </div>
                )}

                {/* Main Content Area — هامش يمين يتغير مع طي/توسيع الشريط */}
                <main 
                    className={`flex-1 p-3 sm:p-4 pb-24 lg:pb-32 lg:pt-4 pt-4 overflow-x-hidden min-w-0 flex flex-col w-full mr-0 transition-[margin-right] duration-300 ease-out ${sidebarCollapsed ? 'lg:mr-[80px]' : 'lg:mr-[280px]'}`}
                    style={{ minHeight: '100vh', paddingBottom: '6rem' }}
                >
                    <div className="flex-1 w-full min-h-full">
                        {/* ✅ Header - Mobile Responsive */}
                        <div className="mb-3 sm:mb-4">
                            <div className="flex items-center justify-between mb-2 gap-2">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    {/* 📱 Mobile Menu Button - Always visible on mobile */}
                                    <button
                                        onClick={() => setShowMobileMenu(true)}
                                        className="lg:hidden w-10 h-10 rounded-xl bg-primary-500/20 hover:bg-primary-500/30 text-primary-500 border border-primary-500/30 flex items-center justify-center transition-all flex-shrink-0 shadow-lg"
                                        aria-label="فتح القائمة"
                                        style={{ zIndex: 50 }}
                                    >
                                        <Menu className="w-5 h-5" />
                                    </button>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                                        <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h1 className="text-lg sm:text-2xl font-bold text-white truncate">{t('admin.mainDashboard')}</h1>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60 truncate">{allBranches.length} {t('sidebar.branch')} {t('auth.activeLabel')} • {t('admin.appManagement')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                    {/* Status dot + optional 360° success ring (no full bar) */}
                                    <div
                                        className="relative flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7"
                                        title={dataJustUpdated ? t('common.success') : (loadingHeavyData || backgroundLoading) ? (t('admin.fetchingData') || 'Loading...') : (t('common.ready') || 'Ready')}
                                        role={dataJustUpdated ? 'button' : undefined}
                                        onClick={dataJustUpdated ? () => setDataJustUpdated(false) : undefined}
                                        aria-label={dataJustUpdated ? t('common.success') : (loadingHeavyData || backgroundLoading) ? 'Loading' : 'Ready'}
                                    >
                                        {dataJustUpdated && !loadingHeavyData && !backgroundLoading && (
                                            <span
                                                className="absolute inset-0 rounded-full border-2 animate-success-ring-360 pointer-events-none"
                                                style={{ borderColor: 'var(--theme-success-500, #22c55e)' }}
                                                aria-hidden
                                            />
                                        )}
                                        <span
                                            className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 relative z-10 ${(loadingHeavyData || backgroundLoading) ? 'animate-status-dot-loading' : ''}`}
                                            style={{
                                                backgroundColor: (loadingHeavyData || backgroundLoading) ? 'var(--theme-error-500, #ef4444)' : 'var(--theme-success-500, #22c55e)',
                                                boxShadow: (loadingHeavyData || backgroundLoading) ? '0 0 0 2px rgba(239,68,68,0.35)' : '0 0 0 2px rgba(34,197,94,0.25)',
                                                transition: 'background-color 0.7s ease-in-out, box-shadow 0.7s ease-in-out'
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={() => loadData(true)}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                                    >
                                        {saving ? <AdoraLoaderInline size={16} /> : <RefreshCw className="w-4 h-4" />}
                                        <span className="hidden sm:inline text-sm font-medium">{t('admin.refresh')}</span>
                                    </button>
                                    <button
                                        onClick={logout}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                                        title={t('admin.logoutTitle')}
                                    >
                                        <LogOut className="w-4 h-4 flip-rtl" />
                                        <span className="hidden sm:inline text-sm font-medium">{t('admin.logout')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ✅ Navigation Bar - Responsive */}
                        <div
                            className="solid-modal rounded-xl sm:rounded-2xl p-2 overflow-hidden md:overflow-x-auto scrollbar-hide mb-4"
                            style={{
                                background: 'var(--theme-bg-secondary)',
                                border: '1px solid var(--theme-border-primary)'
                            }}
                        >
                        <div className="flex items-center gap-2 sm:gap-3 w-full">
                            {/* ✅ Sidebar is always visible - No hamburger menu needed */}

                            {/* 📱 MOBILE: Show current tab name only (hamburger button is in header) */}
                            <div className="flex md:hidden items-center gap-2 flex-1 min-w-0">
                                {(() => {
                                    const tabs = [
                                        { id: 'overview', label: t('admin.overview'), icon: LayoutDashboard, key: 'overview' },
                                        { id: 'tenants', label: t('admin.createManager'), icon: Users, key: 'tenants' },
                                        { id: 'billing', label: t('admin.billing'), icon: CreditCard, key: 'billing' },
                                        { id: 'settings', label: t('admin.systemSettings'), icon: Settings, key: 'settings' },
                                        { id: 'core-config', label: t('admin.coreSetup'), icon: Shield, key: 'core-config' },
                                    ]
                                    .filter(tab => {
                                        const tabKey = (tab as any).key;
                                        return visibleTabs[tabKey as keyof typeof visibleTabs] !== false;
                                    });
                                    const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
                                    const Icon = currentTab.icon;
                                    return (
                                        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-teal-500/20 min-w-0 flex-1">
                                            <Icon className="w-4 h-4 text-teal-400 flex-shrink-0" />
                                            <span className="text-xs sm:text-sm font-medium text-teal-400 truncate">{currentTab.label}</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* 🖥️ DESKTOP: Show all tabs */}
                            <div className="hidden md:flex items-center gap-3 min-w-max">
                                {/* Divider */}
                                <div className="w-px h-8 bg-white/10"></div>

                                {/* Tabs */}
                                <div className="flex gap-1 sm:gap-2" data-tour="owner-tabs">
                                    {[
                                        { id: 'overview' as TabType, label: t('admin.overview'), icon: LayoutDashboard, key: 'overview' },
                                        { id: 'tenants' as TabType, label: t('admin.createManager'), icon: Users, key: 'tenants' },
                                        { id: 'billing' as TabType, label: t('admin.billing'), icon: CreditCard, key: 'billing' },
                                        { id: 'settings' as TabType, label: t('admin.systemSettings'), icon: Settings, key: 'settings' },
                                        { id: 'subscription-requests' as TabType, label: t('admin.subscriptionRequests'), icon: MessageSquare, key: 'subscription-requests' },
                                        { id: 'core-config' as TabType, label: t('admin.coreSetup'), icon: Shield, hidden: true, key: 'core-config' },
                                        // ✅ REMOVED: broadcasts (not owner's responsibility)
                                    ]
                                    .filter(tab => {
                                        // ✅ Filter: Only show tabs that are enabled in visibleTabs config
                                        const tabKey = (tab as any).key;
                                        return visibleTabs[tabKey as keyof typeof visibleTabs] !== false;
                                    })
                                    .map(tab => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        const isHidden = (tab as any).hidden;

                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    if (tab.id === 'core-config') {
                                                        // ✅ Show password modal for core-config
                                                        setShowCoreConfigModal(true);
                                                        setCoreConfigPassword('');
                                                    } else {
                                                        setSearchParams({ tab: tab.id });
                                                    }
                                                }}
                                                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm font-medium ${isActive
                                                        ? isHidden
                                                            ? 'bg-red-500/20 text-red-400 shadow-sm ring-1 ring-red-500/30'
                                                            : 'bg-teal-500/20 text-teal-400 shadow-sm'
                                                        : isHidden
                                                            ? 'hover:bg-red-500/10 opacity-60 hover:opacity-100'
                                                            : 'hover:bg-slate-100 dark:hover:bg-white/5'
                                                    }`}
                                                style={{
                                                    color: isActive
                                                        ? isHidden
                                                            ? 'rgb(248, 113, 113)'
                                                            : 'var(--theme-primary-400, #2dd4bf)'
                                                        : 'var(--theme-text-secondary)',
                                                }}
                                                title={isHidden ? t('admin.hiddenPageOwnerOnly') : undefined}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ✅ Success state: 360° ring around status dot only (bar removed) */}

                    {/* ✅ TABS MOVED TO NAVBAR - More space for content */}

                    {/* License Notifications Widget - Always visible */}
                    <LicenseNotificationWidget forOwner={true} maxNotifications={5} />

                    {/* Tab Content */}
                    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                systemSettings={effectiveSettings}
                                analytics={analytics}
                                onMaintenanceToggle={handleMaintenanceMode}
                                allBranches={allBranches} // ✅ SaaS Integration
                                mrr={mrr}
                                arr={arr}
                                monthlyRenewalRevenue={monthlyRenewalRevenue}
                                totalRevenue={totalRevenue} // ✅ Pass totalRevenue to OverviewTab
                                nearestExpiring={nearestExpiring}
                                multiBranchData={multiBranchData}
                                managerStats={managerStats} // ✅ Manager status stats
                                activityLogs={activityLogs} // ✅ Activity feed (on-demand)
                                onActivityRefresh={setActivityLogs} // ✅ Callback for manual refresh
                                demoStats={demoStats} // ✅ Demo stats (separate from main stats)
                            />
                        )}

                        {activeTab === 'tenants' && (
                            <TenantsTab
                                tenants={tenants}
                                onRefresh={() => loadData(true)}  // ✅ FIX: Force refresh to clear cache
                                onAddManager={() => setShowAddManagerModal(true)}
                                onViewDetails={(tenant) => {
                                    logger.debug('👁️ View Details clicked:', { tenantName: tenant.tenantName, tenantId: tenant.tenantId }, 'EnhancedOwnerDashboard');
                                    logger.debug('👁️ Setting showManagerDetailsModal to true', undefined, 'EnhancedOwnerDashboard');
                                    setSelectedManager(tenant);
                                    setShowManagerDetailsModal(true);
                                    logger.debug('👁️ States should be set now', undefined, 'EnhancedOwnerDashboard');
                                }}
                            />
                        )}

                        {activeTab === 'settings' && (
                            <SettingsTab
                                systemSettings={effectiveSettings}
                                onSave={handleSaveSettings}
                                saving={saving}
                                features={safeFeatures}
                                onToggleFeature={handleToggleFeature}
                            />
                        )}

                        {/* ✅ REMOVED: updates and broadcasts tabs - not owner's responsibility */}

                        {activeTab === 'billing' && (
                            <BillingDashboard embedded />
                        )}

                        {/* 🔐 Hidden Core Config Tab - Only for Super Admin */}
                        {activeTab === 'core-config' && coreConfigAccessGranted && (
                            <CoreConfigTemplate
                                onSave={() => success(t('admin.coreConfigSaved'))}
                            />
                        )}
                        {activeTab === 'core-config' && !coreConfigAccessGranted && (
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <Shield className="w-16 h-16 text-teal-400 mx-auto mb-4 opacity-50" />
                                    <p className="text-slate-600 dark:text-white/60">{t('admin.enterPasswordForConfigMode')}</p>
                                </div>
                            </div>
                        )}

                        {/* 📋 Subscription Requests Tab */}
                        {activeTab === 'subscription-requests' && (
                            <SubscriptionRequestsTab key={`subscription-requests-${subscriptionTabRefreshKey}`} />
                        )}
                    </div>
                    </div>
                </main>

                {/* Modals - Rendered OUTSIDE main container */}
                {showUpdateModal && (
                    <UpdateModal
                        onClose={() => setShowUpdateModal(false)}
                        onSave={async (update) => {
                            await addSystemUpdate(update, user?.id || 'system');
                            await loadData(true); // Force refresh
                            setShowUpdateModal(false);
                            success(t('admin.updateAdded'));
                        }}
                    />
                )}

                {showBroadcastModal && (
                    <BroadcastModal
                        onClose={() => setShowBroadcastModal(false)}
                        onSave={async (message) => {
                            await addBroadcastMessage(message, user?.id || 'system');
                            await loadData(true); // Force refresh
                            setShowBroadcastModal(false);
                            success(t('admin.messageAdded'));
                        }}
                    />
                )}
            </div>

            {/* ✅ Core Config Password Modal - Rendered in portal so close/cancel buttons work (no stacking-context trap) */}
            {showCoreConfigModal && createPortal(
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'var(--theme-overlay-backdrop, rgba(0, 0, 0, 0.75))',
                        backdropFilter: 'blur(8px)',
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowCoreConfigModal(false);
                            setCoreConfigPassword('');
                        }
                    }}
                >

                    {/* Modal Content - pointer-events-auto so buttons receive clicks */}
                    <div
                        className="relative w-full max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl glass-card mx-2 sm:mx-0"
                        style={{
                            background: 'var(--theme-bg-secondary)',
                            border: '2px solid var(--theme-primary-500)',
                            zIndex: 100000,
                            position: 'relative',
                            boxShadow: 'var(--theme-shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.3))',
                            pointerEvents: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{
                                    background: 'var(--theme-primary-500)',
                                    opacity: 0.2
                                }}
                            >
                                <Shield 
                                    className="w-6 h-6" 
                                    style={{ color: 'var(--theme-primary-400)' }}
                                />
                            </div>
                            <div className="flex-1">
                                <h3 
                                    className="text-xl font-bold"
                                    style={{ color: 'var(--theme-text-primary)' }}
                                >
                                    {t('admin.coreSetup')}
                                </h3>
                                <p 
                                    className="text-sm"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                >
                                    {t('admin.enterRequiredPassword')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCoreConfigModal(false);
                                    setCoreConfigPassword('');
                                }}
                                className="p-2 rounded-lg transition-colors hover:opacity-70"
                                style={{ 
                                    background: 'var(--theme-bg-tertiary)',
                                    color: 'var(--theme-text-secondary)',
                                    pointerEvents: 'auto',
                                }}
                                aria-label={t('common.close') || 'إغلاق'}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="mb-6">
                            <label 
                                className="block text-sm font-medium mb-2"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                {t('admin.enterPassword')}
                            </label>
                            <input
                                id="core-config-password"
                                name="coreConfigPassword"
                                type="password"
                                value={coreConfigPassword}
                                onChange={(e) => setCoreConfigPassword(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && coreConfigPassword.trim() === 'ADORA2026') {
                                        handleCoreConfigAccess();
                                    }
                                }}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all text-center font-mono text-base sm:text-lg tracking-wider input"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)',
                                }}
                                placeholder="••••••••"
                                autoFocus
                            />
                            {coreConfigPassword && coreConfigPassword.trim() !== 'ADORA2026' && (
                                <p 
                                    className="text-xs mt-2 flex items-center gap-1"
                                    style={{ color: 'var(--theme-error-500, #ef4444)' }}
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    {t('admin.passwordIncorrect')}
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCoreConfigModal(false);
                                    setCoreConfigPassword('');
                                }}
                                className="flex-1 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 rounded-xl border font-medium transition-all text-sm sm:text-base"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)',
                                    pointerEvents: 'auto',
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleCoreConfigAccess}
                                disabled={coreConfigPassword.trim() !== 'ADORA2026'}
                                className="flex-1 px-6 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: coreConfigPassword.trim() === 'ADORA2026' 
                                        ? 'var(--theme-primary-500)' 
                                        : 'var(--theme-bg-tertiary)',
                                    color: coreConfigPassword.trim() === 'ADORA2026' 
                                        ? 'white' 
                                        : 'var(--theme-text-disabled)',
                                    borderColor: coreConfigPassword.trim() === 'ADORA2026' 
                                        ? 'var(--theme-primary-500)' 
                                        : 'var(--theme-border-primary)',
                                    boxShadow: coreConfigPassword.trim() === 'ADORA2026' 
                                        ? '0 10px 25px var(--theme-primary-500)' 
                                        : 'none',
                                    opacity: coreConfigPassword.trim() === 'ADORA2026' ? 1 : 0.5,
                                }}
                            >
                                {t('admin.enter')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ✅ Add Manager Modal - Rendered OUTSIDE main container */}
            {showAddManagerModal && (
                <AddManagerModal
                    systemSettings={effectiveSettings}
                    onClose={() => {
                        clearAddManagerDraft();
                        setShowAddManagerModal(false);
                    }}
                    onSuccess={async () => {
                        clearAddManagerDraft();
                        setShowAddManagerModal(false);
                        await loadData(true); // Force refresh after adding manager
                        success(t('admin.managerAdded'));
                        setSearchParams({ tab: 'billing' });
                    }}
                />
            )}

            {/* ✅ Manager Details Modal - Enhanced for Light Mode + Print */}
            {showManagerDetailsModal && selectedManager && (
                <div className="fixed inset-0 z-[100] bg-black/40 dark:bg-black/80 flex items-center justify-center p-2 sm:p-4" style={{ backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white dark:bg-slate-800/90 dark:backdrop-blur-sm rounded-xl w-full max-w-md sm:max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700/50 max-h-[90vh] flex flex-col">
                        {/* Header - مضموم */}
                        <div className="flex items-center justify-between px-3 py-2 sm:py-2.5 border-b border-slate-200 dark:border-slate-700/50 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-slate-800/80 dark:to-slate-800/80 flex-shrink-0">
                            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                <span className="truncate">{t('admin.managerDetails')}</span>
                            </h3>
                            <div className="flex items-center gap-2">
                                {/* Print Button */}
                                <button
                                    onClick={() => {
                                        const printWindow = window.open('', '_blank');
                                        if (!printWindow) return;
                                        printWindow.document.write(`
                                            <!DOCTYPE html>
                                            <html dir="rtl" lang="ar">
                                            <head>
                                                <meta charset="UTF-8">
                                                <title>${t('admin.subscriptionReportTitle', { name: selectedManager.tenantName })}</title>
                                                <style>
                                                    * { font-family: 'Segoe UI', Tahoma, sans-serif; box-sizing: border-box; }
                                                    body { padding: 40px; background: white; color: #1e293b; line-height: 1.6; }
                                                    .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }
                                                    .header h1 { color: #0d9488; margin: 0 0 10px 0; font-size: 28px; }
                                                    .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
                                                    .section h3 { color: #0d9488; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin: 0 0 15px 0; }
                                                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                                                    .stat { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                                                    .stat-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
                                                    .stat-value { font-size: 18px; font-weight: bold; color: #1e293b; }
                                                    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
                                                    .badge-green { background: #dcfce7; color: #166534; }
                                                    .badge-yellow { background: #fef3c7; color: #92400e; }
                                                    .badge-red { background: #fee2e2; color: #991b1b; }
                                                    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
                                                    @media print { body { padding: 20px; } }
                                                </style>
                                            </head>
                                            <body>
                                                <div class="header">
                                                    <h1>${t('admin.adoraSubscriptionReport')}</h1>
                                                    <p><strong>${selectedManager.tenantName}</strong></p>
                                                    <p>${t('admin.managerCode')}: ${selectedManager.managerCode || t('admin.notSpecified')}</p>
                                                    <p>${t('admin.reportDate')}: ${formatDateGregorianEn(new Date(), 'long')}</p>
                                                </div>
                                                
                                                <div class="section">
                                                    <h3>${t('admin.subscriberInfo')}</h3>
                                                    <div class="grid">
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.brandName')}</div>
                                                            <div class="stat-value">${selectedManager.tenantName}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.managerName')}</div>
                                                            <div class="stat-value">${selectedManager.managerName || t('admin.notSpecified')}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.managerCodeLabel')}</div>
                                                            <div class="stat-value">${selectedManager.managerCode || t('admin.notSpecified')}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="section">
                                                    <h3>${t('admin.statistics')}</h3>
                                                    <div class="grid">
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalEmployees')}</div>
                                                            <div class="stat-value">${selectedManager.totalEmployees}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalBranches')}</div>
                                                            <div class="stat-value">${selectedManager.totalBranches}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalRooms')}</div>
                                                            <div class="stat-value">${selectedManager.totalRooms}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalRequests')}</div>
                                                            <div class="stat-value">${selectedManager.totalRequests}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="section">
                                                    <h3>${t('admin.licenseInfo')}</h3>
                                                    <div class="grid">
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.startDate')}</div>
                                                            <div class="stat-value">${formatDateGregorianEn(toSafeDate(selectedManager.subscriptionStartDate))}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.endDate')}</div>
                                                            <div class="stat-value">${formatDateGregorianEn(toSafeDate(selectedManager.licenseExpiryDate))}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.remainingDays')}</div>
                                                            <div class="stat-value">
                                                                <span class="badge ${selectedManager.daysUntilExpiry > 30 ? 'badge-green' : selectedManager.daysUntilExpiry > 7 ? 'badge-yellow' : 'badge-red'}">
                                                                    ${selectedManager.daysUntilExpiry} ${t('admin.days')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.status')}</div>
                                                            <div class="stat-value">
                                                                <span class="badge ${selectedManager.status === 'active' ? 'badge-green' : selectedManager.status === 'suspended' ? 'badge-yellow' : 'badge-red'}">
                                                                    ${selectedManager.status === 'active' ? t('admin.active') : selectedManager.status === 'suspended' ? t('admin.suspended') : t('admin.expired')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="footer">
                                                    <p>{t('admin.reportGeneratedBy')}</p>
                                                    <p>© ${new Date().getFullYear()} Adora Hotel Management System</p>
                                                </div>
                                            </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                        printWindow.print();
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-500/30 transition-colors border border-teal-300 dark:border-teal-500/30"
                                    title={t('admin.printSubscriptionReport')}
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline text-xs">{t('admin.print')}</span>
                                </button>
                                {/* Close Button */}
                                <button
                                    onClick={() => {
                                        setShowManagerDetailsModal(false);
                                        setSelectedManager(null);
                                    }}
                                    className="p-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5 text-slate-600 dark:text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Content - مضموم + سكرول لو طال */}
                        <div className="px-2.5 py-2 sm:px-3 sm:py-2.5 space-y-2 bg-slate-50 dark:bg-slate-900/50 overflow-y-auto flex-1 min-h-0">
                            {/* Basic Info - صف واحد مضغوط */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-0.5 font-medium">{t('admin.brandName')}</p>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{selectedManager.tenantName}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-0.5 font-medium">{t('admin.managerName')}</p>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{selectedManager.managerName || t('admin.notSpecified')}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-0.5 font-medium">{t('admin.managerCodeLabel')}</p>
                                    <p className="text-xs font-bold text-teal-600 dark:text-teal-400 font-mono">{selectedManager.managerCode || t('admin.notSpecified')}</p>
                                </div>
                                <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-0.5 font-medium">{t('admin.totalBranches')}</p>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white">{selectedManager.totalBranches || 0}</p>
                                </div>
                            </div>

                            {/* Branch Codes + Status في صف واحد */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {(() => {
                                    const branchList = selectedManager.branches && selectedManager.branches.length > 0
                                        ? selectedManager.branches
                                        : ((selectedManager as any).branchCodes || []).map((code: string) => ({
                                            id: `branch-${code}`,
                                            name: `فرع ${code}`,
                                            code: code
                                        }));
                                    return branchList.length > 0 ? (
                                        <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                            <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-medium flex items-center gap-1">
                                                <Building2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                                                أكواد الفروع ({branchList.length})
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {branchList.map((branch: any) => (
                                                    <span
                                                        key={branch.id || branch.code}
                                                        className="px-1.5 py-0.5 bg-teal-50 dark:bg-slate-700/60 text-teal-700 dark:text-teal-400 rounded border border-teal-200 dark:border-teal-500/30 text-[10px] font-medium inline-flex items-center gap-1"
                                                    >
                                                        {branch.name || `فرع ${branch.code}`}
                                                        {branch.code && <span className="font-mono font-bold">{branch.code}</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                                {/* Status */}
                                <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-medium">{t('admin.status')}</p>
                                    <div className="flex items-center gap-1.5">
                                        {selectedManager.status === 'active' && (
                                            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded text-[10px] border border-green-300 dark:border-green-500/30 font-semibold inline-flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />{t('admin.activeStatus')}
                                            </span>
                                        )}
                                        {selectedManager.status === 'suspended' && (
                                            <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded text-[10px] border border-yellow-300 dark:border-yellow-500/30 font-semibold inline-flex items-center gap-1">
                                                <Pause className="w-3 h-3" />{t('admin.suspendedStatus')}
                                            </span>
                                        )}
                                        {selectedManager.status === 'expired' && (
                                            <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded text-[10px] border border-red-300 dark:border-red-500/30 font-semibold inline-flex items-center gap-1">
                                                <X className="w-3 h-3" />{t('admin.expiredLicense')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Statistics - صف واحد 4 خانات مضمومة */}
                            <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-medium">{t('admin.statistics')}</p>
                                <div className="grid grid-cols-4 gap-1">
                                    <div className="bg-blue-50 dark:bg-slate-800/70 rounded p-1.5 text-center border border-blue-200 dark:border-blue-500/30">
                                        <Users className="w-3 h-3 text-blue-600 dark:text-blue-400 mx-auto mb-0.5" />
                                        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{selectedManager.totalEmployees || 0}</p>
                                        <p className="text-[9px] text-slate-600 dark:text-slate-300">{t('common.employee')}</p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-slate-800/70 rounded p-1.5 text-center border border-purple-200 dark:border-purple-500/30">
                                        <Building2 className="w-3 h-3 text-purple-600 dark:text-purple-400 mx-auto mb-0.5" />
                                        <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{selectedManager.totalBranches || 0}</p>
                                        <p className="text-[9px] text-slate-600 dark:text-slate-300">{t('sidebar.branch')}</p>
                                    </div>
                                    <div className="bg-teal-50 dark:bg-slate-800/70 rounded p-1.5 text-center border border-teal-200 dark:border-teal-500/30">
                                        <DoorOpen className="w-3 h-3 text-teal-600 dark:text-teal-400 mx-auto mb-0.5" />
                                        <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{selectedManager.totalRooms || 0}</p>
                                        <p className="text-[9px] text-slate-600 dark:text-slate-300">{t('common.room')}</p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-slate-800/70 rounded p-1.5 text-center border border-green-200 dark:border-green-500/30">
                                        <Activity className="w-3 h-3 text-green-600 dark:text-green-400 mx-auto mb-0.5" />
                                        <p className="text-sm font-bold text-green-700 dark:text-green-300">{selectedManager.totalRequests || 0}</p>
                                        <p className="text-[9px] text-slate-600 dark:text-slate-300">{t('common.request')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* License + Last Activity في صف واحد */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                    <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-medium">{t('admin.licenseInfo')}</p>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 rounded p-1.5 border border-slate-200 dark:border-slate-700/50">
                                            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">{t('admin.endDate')}</span>
                                            <span className="text-[10px] text-slate-900 dark:text-white font-bold">{formatDateGregorianEn(toSafeDate(selectedManager.licenseExpiryDate), 'medium')}</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 rounded p-1.5 border border-slate-200 dark:border-slate-700/50">
                                            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">{t('admin.remainingDays')}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${selectedManager.daysUntilExpiry <= 7 ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-slate-800/60' : selectedManager.daysUntilExpiry <= 30 ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-slate-800/60' : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-slate-800/60'}`}>
                                                {selectedManager.daysUntilExpiry} {t('admin.days')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {selectedManager.lastActivity && (
                                    <div className="bg-white dark:bg-slate-800/60 rounded-md p-1.5 border border-slate-200 dark:border-slate-700/50">
                                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mb-1 font-medium flex items-center gap-1"><Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />{t('admin.lastActivity')}</p>
                                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 rounded p-1.5 border border-slate-200 dark:border-slate-700/50">
                                            <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">{t('admin.lastRequest')}</span>
                                            <span className="text-[10px] text-slate-900 dark:text-white font-bold">
                                                {(() => {
                                                    const lastActivity = toSafeDate(selectedManager.lastActivity);
                                                    const now = new Date();
                                                    const diffMs = now.getTime() - lastActivity.getTime();
                                                    const diffMins = Math.floor(diffMs / (1000 * 60));
                                                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
                                                    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
                                                    if (diffDays < 7) return `منذ ${diffDays} يوم`;
                                                    return formatDateGregorianEn(lastActivity, 'medium');
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-2 py-1.5 border-t border-slate-200 dark:border-white/10 flex-shrink-0">
                            <button
                                onClick={() => {
                                    setShowManagerDetailsModal(false);
                                    setSelectedManager(null);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white transition-colors text-xs"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageTransition>
    );
};

// ============================================================
// TAB COMPONENTS
// ============================================================

const OverviewTab: React.FC<{
    systemSettings: SystemSettings;
    analytics: any;
    onMaintenanceToggle: (enabled: boolean, message?: string) => void;
    allBranches?: any[]; // ✅ SaaS Integration
    mrr?: number;
    arr?: number;
    monthlyRenewalRevenue?: number;
    totalRevenue?: number; // ✅ Total revenue from all invoices
    nearestExpiring?: {
        subscription: any;
        daysUntilExpiry: number;
        branchName?: string;
        tenantName?: string;
    } | null;
    multiBranchData?: {
        totalUsers: number;
        totalRequests: number;
        totalRooms: number;
        revenue: number;
    } | null;
    managerStats?: {
        active: number;
        suspended: number;
        deleted: number;
        expired: number;
        total: number;
    };
    activityLogs?: AuditLog[]; // ✅ Activity feed (on-demand, no polling)
    onActivityRefresh?: (logs: AuditLog[]) => void; // ✅ Callback to update parent state
    demoStats?: {
        total: number;
        nearestExpiry: Date | null;
        farthestExpiry: Date | null;
    }; // ✅ Demo stats (separate from main stats)
}> = ({
    systemSettings,
    analytics,
    onMaintenanceToggle,
    allBranches = [],
    mrr = 0,
    arr = 0,
    monthlyRenewalRevenue = 0,
    totalRevenue = 0, // ✅ Default to 0 if not provided
    nearestExpiring = null,
    multiBranchData = null,
    managerStats = { active: 0, suspended: 0, deleted: 0, expired: 0, total: 0 },
    activityLogs = [],
    onActivityRefresh,
    demoStats = { total: 0, nearestExpiry: null, farthestExpiry: null }
}) => {
        const { user } = useAuth(); // ✅ Get user for DataHealthReportCard
        const { t } = useTranslation();
        const [isBranchesExpanded, setIsBranchesExpanded] = useState(false); // ✅ Collapsed by default, show 5 only
        const [isActivityExpanded, setIsActivityExpanded] = useState(false); // ✅ Activity feed collapsed by default (saves space)
        const [isStatsExpanded, setIsStatsExpanded] = useState(false); // ✅ Stats cards collapsed by default (saves space)
        const [refreshingActivity, setRefreshingActivity] = useState(false);
        const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

        // Manual refresh handler - ONLY way to fetch new data
        const handleRefreshActivity = async () => {
            setRefreshingActivity(true);
            try {
                const logs = await forceRefreshActivity();
                onActivityRefresh?.(logs);
                setLastRefreshTime(new Date());
            } catch (error) {
                logger.error('Failed to refresh activity:', error, 'EnhancedOwnerDashboard');
            }
            setRefreshingActivity(false);
        };
        return (
            <div className="space-y-4 sm:space-y-6">
                {/* Critical Alerts - Mobile First */}
                {systemSettings.maintenanceMode && (
                    <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-yellow-500/30 bg-yellow-500/10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                            <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base sm:text-lg font-bold text-white mb-1 sm:mb-0">{t('admin.maintenanceModeEnabled')}</h3>
                                    <p className="text-sm sm:text-base text-white/60 leading-relaxed">{systemSettings.maintenanceMessage}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onMaintenanceToggle(false)}
                                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-500/20 text-green-400 rounded-lg sm:rounded-xl hover:bg-green-500/30 transition-colors border border-green-500/20 text-sm whitespace-nowrap"
                            >
                                {t('admin.cancelMaintenance')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Quick Stats - ✅ ADORA PREMIUM COMPACT DESIGN - Collapsible & Fully Responsive */}
                <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                    {/* Header - Clickable */}
                    <div
                        onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                        className="flex items-center justify-between p-2.5 sm:p-3 lg:p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/10 flex-shrink-0">
                                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm sm:text-base font-bold text-white mb-0.5 sm:mb-1">الإحصائيات السريعة</h3>
                                <p className="text-xs sm:text-sm text-white/50 hidden sm:block">
                                    {t('admin.quickStatsDescription')}
                                </p>
                            </div>
                        </div>
                        <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isStatsExpanded ? '' : 'rotate-180'}`}>
                            <ChevronDown className="w-4 h-4 text-white/60" />
                        </div>
                    </div>

                    {/* Collapsible Content */}
                    <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-slate-50 dark:bg-slate-800/60 ${isStatsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                        <div className="p-3 sm:p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4" data-tour="owner-overview-stats">
                                <StatCard
                                    icon={Building2}
                                    iconColor="teal"
                                    label={t('admin.totalBranches')}
                                    count={allBranches.length}
                                />
                                <StatCard
                                    icon={Users}
                                    iconColor="blue"
                                    label={t('admin.totalUsers')}
                                    count={multiBranchData?.totalUsers || analytics?.totalUsers || 0}
                                />
                                <StatCard
                                    icon={Activity}
                                    iconColor="orange"
                                    label={t('admin.totalRequests')}
                                    count={multiBranchData?.totalRequests || analytics?.totalRequestsToday || 0}
                                />
                                <StatCard
                                    icon={DoorOpen}
                                    iconColor="green"
                                    label={t('admin.totalRooms')}
                                    count={multiBranchData?.totalRooms || 0}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ✅ Demo Stats Card - Separate from main stats */}
                {demoStats.total > 0 && (
                    <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-purple-500/30 bg-purple-500/10">
                        <div className="flex items-start gap-2 sm:gap-3 lg:gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                                    {t('admin.demoAccounts')}
                                </h3>
                                <p className="text-xl sm:text-2xl font-bold text-purple-400 mb-2">
                                    {demoStats.total} {t('admin.account')}
                                </p>
                                <div className="space-y-1 text-xs sm:text-sm text-white/60">
                                    {demoStats.nearestExpiry && (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                            <span>{t('admin.nearestExpiry')}: {formatDateGregorianEn(demoStats.nearestExpiry, 'long')}</span>
                                        </div>
                                    )}
                                    {demoStats.farthestExpiry && demoStats.farthestExpiry.getTime() !== demoStats.nearestExpiry?.getTime() && (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                            <span>{t('admin.farthestExpiry')}: {formatDateGregorianEn(demoStats.farthestExpiry, 'long')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ Manager Status Cards - Unified Design & Fully Responsive with Enhanced Shadows */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                    <div 
                        className="solid-modal rounded-xl p-4 border border-green-500/30 bg-green-500/10 hover:border-green-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(34, 197, 94, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-green-400 truncate">{managerStats.active}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.activeLicense')}</p>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="solid-modal rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10 hover:border-yellow-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(234, 179, 8, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                <Pause className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-yellow-400 truncate">{managerStats.suspended}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.suspendedLicense')}</p>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="solid-modal rounded-xl p-4 border border-red-500/30 bg-red-500/10 hover:border-red-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(239, 68, 68, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <X className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-red-400 truncate">{managerStats.expired}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.expiredLicense')}</p>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="solid-modal rounded-xl p-4 border border-gray-500/30 bg-gray-500/10 hover:border-gray-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(107, 114, 128, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-gray-400 truncate">{managerStats.deleted}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.deletedLicense')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Revenue Cards - ✅ COMPACT PREMIUM DESIGN - Fully Responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                    <StatCard
                        icon={DollarSign}
                        iconColor="purple"
                        label={t('admin.totalRevenue')}
                        value={`${(totalRevenue || 0).toLocaleString()} ${t('common.rs')}`}
                    />
                    <StatCard
                        icon={TrendingUp}
                        iconColor="green"
                        label={t('admin.monthlyRecurringRevenue')}
                        value={`${mrr.toLocaleString()} ${t('common.rs')}`}
                    />
                    <StatCard
                        icon={DollarSign}
                        iconColor="blue"
                        label={t('admin.annualRecurringRevenue')}
                        value={`${arr.toLocaleString()} ${t('common.rs')}`}
                    />
                    <StatCard
                        icon={Calendar}
                        iconColor="yellow"
                        label={t('admin.monthlyRenewals')}
                        value={`${monthlyRenewalRevenue.toLocaleString()} ${t('common.rs')}`}
                    />
                </div>

                {/* Expiring Subscription Alert - Mobile First */}
                {nearestExpiring && (
                    <div className="stat-card-pro-compact glass rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border border-yellow-500/30 bg-yellow-500/10">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] sm:text-xs text-white/60 mb-1">{t('admin.nearestSubscriptionExpiring')}</div>
                                <div className="text-xs sm:text-sm font-bold text-white mb-1 truncate">
                                    {nearestExpiring.branchName || nearestExpiring.tenantName || t('admin.branch')}
                                </div>
                                <div className="text-[10px] sm:text-xs text-yellow-400">
                                    {t('admin.daysRemainingFor', { days: nearestExpiring.daysUntilExpiry })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* System Status - Mobile First */}
                <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6">
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 lg:mb-4" style={{ color: 'var(--theme-text-primary)' }}>{t('admin.systemStatus')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                        <StatusItem
                            label={t('admin.version')}
                            value={systemSettings.systemVersion}
                            icon={Zap}
                            color="blue"
                        />
                        <StatusItem
                            label={t('admin.performanceRate')}
                            value={`${analytics?.uptime || 99.9}%`}
                            icon={CheckCircle}
                            color="green"
                        />
                        <StatusItem
                            label={t('admin.errorRate')}
                            value={`${analytics?.errorRate || 0}%`}
                            icon={AlertTriangle}
                            color={analytics?.errorRate > 1 ? 'red' : 'yellow'}
                        />
                    </div>
                </div>

                {/* Branches Summary - Compact from MultiBranchDashboard - Collapsible - Mobile First */}
                {allBranches.length > 0 && (
                    <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                        {/* Header - Clickable */}
                        <div
                            onClick={() => setIsBranchesExpanded(!isBranchesExpanded)}
                            className="flex items-center justify-between p-3 sm:p-4 lg:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/10 flex-shrink-0">
                                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">{t('admin.allBranches')} ({allBranches.length})</h3>
                                </div>
                            </div>
                            <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isBranchesExpanded ? '' : 'rotate-180'}`}>
                                <ChevronDown className="w-4 h-4 text-white/60" />
                            </div>
                        </div>

                        {/* Collapsible Content */}
                        <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-slate-50 dark:bg-slate-800/60 ${isBranchesExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                            <div className="p-3 sm:p-4 lg:p-6">
                                <div className="space-y-2">
                                    {allBranches.slice(0, isBranchesExpanded ? allBranches.length : 5).map((branch: any) => (
                                        <div
                                            key={branch.id || `${branch.tenantId}_${branch.id}`}
                                            className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-all border border-white/5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-white text-sm truncate">{branch.name || branch.id}</h4>
                                                        {branch.managerName && (
                                                            <p className="text-xs text-white/50 truncate">
                                                                {t('admin.manager')}: {branch.managerName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {!isBranchesExpanded && allBranches.length > 5 && (
                                    <div className="text-center pt-4 mt-4 border-t border-white/5">
                                        <p className="text-xs text-white/40">
                                            {t('admin.andMoreBranches', { count: allBranches.length - 5 })}
                                        </p>
                                    </div>
                                )}
                                {isBranchesExpanded && allBranches.length > 5 && (
                                    <div className="text-center pt-4 mt-4 border-t border-white/5">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsBranchesExpanded(false);
                                            }}
                                            className="text-xs text-white/60 hover:text-white transition-colors"
                                        >
                                            {t('admin.hide')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ Data Health Report - Weekly System Health */}
                <DataHealthReportCard
                    tenantId={user?.role === 'owner' ? (user?.tenantId || 'system-owner' || 'owner') : (user?.id || '')}
                    onViewDetails={(report) => {
                        logger.debug('View report details:', report.id, 'EnhancedOwnerDashboard');
                        // Could open a detailed modal here
                    }}
                />

                {/* ✅ Live Activity Feed - Ultra-efficient polling (1 read/min max) */}
                <div className="solid-modal rounded-xl sm:rounded-2xl overflow-hidden">
                    {/* Header - Clickable */}
                    <div
                        onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                        className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base sm:text-xl font-bold mb-0.5 sm:mb-1" style={{ color: 'var(--theme-text-primary)' }}>
                                    {t('admin.liveActivityFeed')}
                                </h3>
                                <p className="text-xs sm:text-sm hidden sm:block" style={{ color: 'var(--theme-text-secondary)' }}>
                                    {t('admin.logAllEvents')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Manual Refresh Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRefreshActivity();
                                }}
                                disabled={refreshingActivity}
                                className="p-2 rounded-lg transition-colors"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    border: '1px solid var(--theme-border-primary)',
                                }}
                                title={t('admin.manualRefresh')}
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshingActivity ? 'animate-spin' : ''}`} style={{ color: 'var(--theme-text-secondary)' }} />
                            </button>
                            <div className={`p-2 rounded-lg transition-transform duration-300 flex-shrink-0 ${isActivityExpanded ? '' : 'rotate-180'}`}
                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                <ChevronDown className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                            </div>
                        </div>
                    </div>

                    {/* Collapsible Content */}
                    <div className={`transition-all duration-300 ease-in-out border-t ${isActivityExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                        style={{ borderColor: 'var(--theme-border-primary)', background: 'var(--theme-bg-tertiary)' }}>
                        <div className="p-3 sm:p-4 lg:p-6">
                            {(!activityLogs || activityLogs.length === 0) ? (
                                <div className="text-center py-8">
                                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--theme-text-primary)' }} />
                                    <p style={{ color: 'var(--theme-text-secondary)' }}>لا يوجد نشاط حديث</p>
                                    <p className="text-xs mt-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        سيظهر هنا كل ما يحدث في النظام
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {(activityLogs || []).map((log, index) => (
                                        <div
                                            key={log.id || index}
                                            className="flex items-start gap-2 p-2 rounded-md transition-colors hover:bg-white/5"
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                border: '1px solid var(--theme-border-primary)',
                                            }}
                                        >
                                            {/* Icon */}
                                            <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-sm"
                                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                {getActionIcon(log.action)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`font-medium text-xs ${getActionColor(log.action)}`}>
                                                        {getActionLabel(log.action)}
                                                    </span>
                                                    {log.targetName && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                                                            style={{
                                                                background: 'var(--theme-bg-tertiary)',
                                                                color: 'var(--theme-text-secondary)',
                                                            }}>
                                                            {log.targetName}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[10px]" style={{ color: 'var(--theme-text-secondary)' }}>
                                                        👤 {log.userName || t('admin.system')}
                                                    </span>
                                                    {log.department && log.department !== 'system' && (
                                                        <span className="text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                            • {log.department}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Details if available */}
                                                {log.details && Object.keys(log.details).length > 0 && (
                                                    <div className="mt-0.5 text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                        {log.details.message && <span>{String(log.details.message)}</span>}
                                                        {log.details.oldValue !== undefined && log.details.newValue !== undefined && (
                                                            <span>
                                                                {String(log.details.oldValue)} → {String(log.details.newValue)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Time */}
                                            <div className="flex-shrink-0 text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                {formatTimeAgo(log.timestamp)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Footer info - Shows on-demand status */}
                            <div className="mt-4 pt-3 border-t flex items-center justify-between flex-wrap gap-2"
                                style={{ borderColor: 'var(--theme-border-primary)' }}>
                                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    {t('admin.powerSavingMode')}
                                </p>
                                <div className="flex items-center gap-3">
                                    {lastRefreshTime && (
                                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            {t('admin.lastUpdate')}: {formatTimeAgo(lastRefreshTime)}
                                        </p>
                                    )}
                                    <p className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {activityLogs?.length || 0} {t('admin.logs')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

type FilterType = 'all' | 'active' | 'suspended' | 'expired' | 'deleted' | 'expiring';

const TenantsTab: React.FC<{
    tenants: TenantAnalytics[];
    onRefresh: () => void;
    onAddManager: () => void;
    onViewDetails?: (tenant: TenantAnalytics) => void;
}> = ({ tenants, onRefresh, onAddManager, onViewDetails }) => {
    const [searchCode, setSearchCode] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [selectedTenant, setSelectedTenant] = useState<TenantAnalytics | null>(null);
    const [managerDetails, setManagerDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [deletedManagers, setDeletedManagers] = useState<any[]>([]);
    const [showDeleted, setShowDeleted] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const { success, error } = useUX();
    const { t } = useTranslation();
    const { user } = useAuth();
    
    // ✅ Deep Audit & Purge System State
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditStatus, setAuditStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [auditProgress, setAuditProgress] = useState<string>('');
    const [showAuditChoiceModal, setShowAuditChoiceModal] = useState(false);
    const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);
    const [resetCode, setResetCode] = useState('');
    const [showScanPasswordModal, setShowScanPasswordModal] = useState(false);
    const [scanPassword, setScanPassword] = useState('');

    // Load deleted managers on mount
    useEffect(() => {
        const loadDeleted = async () => {
            const deleted = await getDeletedManagers();
            setDeletedManagers(deleted);
        };
        loadDeleted();
    }, []);

    // ✅ Helper function to map deleted manager to TenantAnalytics format
    // Used in BOTH "deleted" and "all" filters to avoid code duplication
    const mapDeletedManagerToTenant = useCallback((manager: any): TenantAnalytics & { isDeleted: true } => {
        // Get license expiry date from various possible fields
        let licenseExpiryDate: Date;
        if (manager.licenseExpiry?.toDate) {
            licenseExpiryDate = manager.licenseExpiry.toDate();
        } else if (manager.licenseExpiry) {
            licenseExpiryDate = new Date(manager.licenseExpiry);
        } else if (manager.tenantBackup?.info?.licenseExpiry?.toDate) {
            licenseExpiryDate = manager.tenantBackup.info.licenseExpiry.toDate();
        } else if (manager.tenantBackup?.info?.licenseExpiry) {
            licenseExpiryDate = new Date(manager.tenantBackup.info.licenseExpiry);
        } else {
            licenseExpiryDate = new Date();
        }

        // Calculate days until expiry
        const now = new Date();
        const daysUntilExpiry = Math.ceil((licenseExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
            tenantId: manager.tenantId || manager.id,
            tenantName: manager.hotelName || manager.tenantBackup?.info?.name || manager.name || t('admin.notSpecified'),
            managerName: manager.name,
            managerCode: manager.code,
            plan: (manager.plan || manager.tenantBackup?.info?.plan || 'basic') as 'basic' | 'pro' | 'enterprise',
            status: 'deleted' as const,
            isDeleted: true as const,
            totalEmployees: manager.cachedStats?.totalUsers || manager.tenantBackup?.info?.cachedStats?.totalUsers || 0,
            totalBranches: manager.maxBranches || manager.tenantBackup?.info?.maxBranches || 1,
            totalRooms: manager.cachedStats?.totalRooms || manager.tenantBackup?.info?.cachedStats?.totalRooms || 0,
            totalRequests: manager.cachedStats?.totalRequests || 0,
            totalRequestsToday: 0,
            lastActivity: manager.deletedAt || new Date(),
            activeEmployees: 0,
            activeSessions: 0,
            featuresUsed: {
                qrCode: 0,
                pointsSystem: 0,
                gamification: 0,
                scheduledTasks: 0
            },
            subscriptionStartDate: manager.createdAt?.toDate?.() || new Date(),
            licenseExpiryDate,
            daysUntilExpiry,
            paymentStatus: 'pending' as const,
            employeesGrowth: 0,
            requestsGrowth: 0
        };
    }, []);

    // Filter tenants by status, search, and expiry
    const filteredTenants = useMemo(() => {
        // ✅ FIX: Filter out deleted tenants from the main list to avoid duplicates
        // When we merge deleted managers later, we don't want them appearing twice
        let filtered = tenants
            .filter(t => t.status !== 'deleted')
            .map(t => ({ ...t })); // Create copies to avoid mutation

        // Apply status filter
        if (activeFilter === 'active') {
            filtered = filtered.filter(t => t.status === 'active');
        } else if (activeFilter === 'suspended') {
            filtered = filtered.filter(t => t.status === 'suspended');
        } else if (activeFilter === 'expired') {
            filtered = filtered.filter(t => {
                try {
                    // Use daysUntilExpiry if available (more reliable)
                    if (t.daysUntilExpiry !== undefined && t.daysUntilExpiry !== null) {
                        return t.daysUntilExpiry <= 0 || t.status === 'expired';
                    }

                    // Otherwise calculate from licenseExpiryDate
                    let expiry: Date;
                    if (t.licenseExpiryDate instanceof Date) {
                        expiry = t.licenseExpiryDate;
                    } else if (t.licenseExpiryDate && typeof t.licenseExpiryDate === 'object' && 'toDate' in t.licenseExpiryDate) {
                        expiry = (t.licenseExpiryDate as any).toDate();
                    } else if (typeof t.licenseExpiryDate === 'string') {
                        expiry = new Date(t.licenseExpiryDate);
                    } else {
                        expiry = new Date(t.licenseExpiryDate);
                    }

                    // Check if date is valid
                    if (isNaN(expiry.getTime())) {
                        logger.warn('Invalid expiry date for tenant:', { tenantId: t.tenantId, expiryDate: t.licenseExpiryDate }, 'EnhancedOwnerDashboard');
                        return t.status === 'expired';
                    }

                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    expiry.setHours(0, 0, 0, 0);
                    return expiry < now || t.status === 'expired';
                } catch (error) {
                    logger.warn('Error filtering expired tenant:', { tenantId: t.tenantId, error }, 'EnhancedOwnerDashboard');
                    return t.status === 'expired';
                }
            });
        } else if (activeFilter === 'expiring') {
            // Show ALL tenants sorted by expiry date (closest first)
            // ✅ FIX: {t('admin.excludeDeletedFromExpiring')}
            const deletedIds = new Set(deletedManagers.map((m: any) => m.tenantId || m.id));
            filtered = filtered.filter(t => {
                // ✅ {t('admin.excludeDeleted')}
                if ((t as any).isDeleted || deletedIds.has(t.tenantId)) {
                    return false;
                }
                // Only filter out invalid dates
                try {
                    if (t.daysUntilExpiry !== undefined && t.daysUntilExpiry !== null) {
                        return true; // Has valid daysUntilExpiry
                    }
                    let expiry: Date;
                    if (t.licenseExpiryDate instanceof Date) {
                        expiry = t.licenseExpiryDate;
                    } else if (t.licenseExpiryDate && typeof t.licenseExpiryDate === 'object' && 'toDate' in t.licenseExpiryDate) {
                        expiry = (t.licenseExpiryDate as any).toDate();
                    } else if (typeof t.licenseExpiryDate === 'string') {
                        expiry = new Date(t.licenseExpiryDate);
                    } else {
                        expiry = new Date(t.licenseExpiryDate);
                    }
                    return !isNaN(expiry.getTime()); // Only filter invalid dates
                } catch {
                    return false; // Filter out errors
                }
            });

            // Sort by days until expiry (ascending - closest first)
            filtered.sort((a, b) => {
                // Helper function to get days until expiry
                const getDaysUntil = (tenant: TenantAnalytics): number => {
                    if (tenant.daysUntilExpiry !== undefined && tenant.daysUntilExpiry !== null) {
                        return tenant.daysUntilExpiry;
                    }
                    try {
                        let expiry: Date;
                        if (tenant.licenseExpiryDate instanceof Date) {
                            expiry = tenant.licenseExpiryDate;
                        } else if (tenant.licenseExpiryDate && typeof tenant.licenseExpiryDate === 'object' && 'toDate' in tenant.licenseExpiryDate) {
                            expiry = (tenant.licenseExpiryDate as any).toDate();
                        } else if (typeof tenant.licenseExpiryDate === 'string') {
                            expiry = new Date(tenant.licenseExpiryDate);
                        } else {
                            expiry = new Date(tenant.licenseExpiryDate);
                        }
                        if (isNaN(expiry.getTime())) return 999999; // Put invalid dates at the end
                        const now = new Date();
                        return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    } catch {
                        return 999999; // Put errors at the end
                    }
                };
                return getDaysUntil(a) - getDaysUntil(b);
            });
        } else if (activeFilter === 'deleted') {
            // ✅ REFACTORED: Use helper function to avoid code duplication
            return deletedManagers.map(mapDeletedManagerToTenant);
        }

        // ✅ REFACTORED: For "all" filter, include deleted managers with special marking
        // Uses the same helper function to ensure consistent data
        if (activeFilter === 'all' && deletedManagers.length > 0) {
            const existingTenantIds = new Set(filtered.map(t => t.tenantId));
            const deletedMapped = deletedManagers
                .filter(manager => !existingTenantIds.has(manager.tenantId || manager.id)) // ✅ Avoid duplicates
                .map(mapDeletedManagerToTenant); // ✅ Use same helper function
            filtered = [...filtered, ...deletedMapped];
        }

        // Apply search filter (by name or code)
        if (searchCode) {
            filtered = filtered.filter(tenant =>
                tenant.tenantId?.includes(searchCode) ||
                tenant.tenantName?.toLowerCase().includes(searchCode.toLowerCase()) ||
                tenant.managerName?.toLowerCase().includes(searchCode.toLowerCase())
            );
        }

        return filtered;
    }, [tenants, activeFilter, searchCode, deletedManagers, mapDeletedManagerToTenant]);

    // Load manager details with branches
    const loadManagerDetails = async (tenant: TenantAnalytics) => {
        setLoadingDetails(true);
        try {
            // Get manager user data
            const managers = await getAllManagers();
            const manager = managers.find(m => m.tenantId === tenant.tenantId);

            if (!manager) {
                error(t('admin.managerNotFound'));
                return;
            }

            // Get all branches for this tenant
            if (!db) {
                throw new Error('Database not initialized');
            }
            const branchesQuery = query(
                collection(db, `tenants/${tenant.tenantId}/branches`)
            );
            const branchesSnapshot = await getDocs(branchesQuery);
            const branches = branchesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load details for each branch
            const branchesWithDetails = await Promise.all(
                branches.map(async (branch: any) => {
                    // Get employees count
                    const employeesQuery = query(
                        collection(db, 'users'),
                        where('tenantId', '==', tenant.tenantId),
                        where('branches', 'array-contains', branch.id)
                    );
                    const employeesCount = await getCountFromServer(employeesQuery);

                    // ✅ FIX: Use tenant-scoped collection
                    // Get requests by department
                    const requestsQuery = query(
                        collection(db, `tenants/${tenant.tenantId}/requests`),
                        where('branch', '==', branch.id)
                    );
                    const requestsSnapshot = await getDocs(requestsQuery);
                    const requests = requestsSnapshot.docs.map(d => d.data());

                    // Count requests by department
                    const departmentCounts: Record<string, number> = {};
                    requests.forEach(req => {
                        const dept = req.department || t('admin.notSpecified');
                        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
                    });
                    const topDepartment = Object.entries(departmentCounts)
                        .sort(([, a], [, b]) => b - a)[0]?.[0] || t('admin.noData');

                    // Get enabled features from branch settings
                    const settingsRef = doc(db, `tenants/${tenant.tenantId}/branches/${branch.id}/settings`, 'branch');
                    const settingsSnap = await getDoc(settingsRef);
                    const branchSettings = settingsSnap.exists() ? settingsSnap.data() : {};

                    // Get system settings for enabled features
                    const systemSettings = await getSystemSettings();
                    const enabledFeatures = Object.entries(systemSettings?.features ?? {})
                        .filter(([_, enabled]) => enabled)
                        .map(([key, _]) => key);

                    return {
                        ...branch,
                        employeesCount: employeesCount.data().count,
                        totalRequests: requests.length,
                        topDepartment,
                        departmentCounts,
                        enabledFeatures,
                        createdAt: branch.createdAt || (manager as any).createdAt || Timestamp.now()
                    };
                })
            );

            setManagerDetails({
                manager,
                branches: branchesWithDetails,
                createdAt: (manager as any).createdAt || Timestamp.now()
            });
            setSelectedTenant(tenant);
        } catch (err: any) {
            logger.error('Error loading manager details:', err, 'EnhancedOwnerDashboard');
            error(t('admin.errorLoadingManager'));
        } finally {
            setLoadingDetails(false);
        }
    };

    // ✅ Deep Audit & Purge System Handlers (must be before return — used in modals below)
    const handleScanPasswordConfirm = async () => {
        if (scanPassword.trim() !== 'ADORA2026') {
            error(t('admin.wrongPassword') || 'كلمة المرور غير صحيحة');
            return;
        }
        setShowScanPasswordModal(false);
        setScanPassword('');
        setShowAuditChoiceModal(true);
    };

    const handleDeepAudit = async () => {
        logger.info('Deep Audit button clicked', null, 'TenantsTab');
        if (!user || user.role !== 'owner' || !user.id) {
            error('⚠️ خطأ: هذه العملية متاحة للمالك فقط.');
            return;
        }
        const confirm1 = await customConfirm({
            type: 'warning',
            title: t('admin.deepAuditProtocol') || '🔍 Deep Audit Protocol',
            message: t('admin.deepAuditMessage') || 'سيتم فحص النظام بالكامل (Firestore, Auth, Storage) وحذف أي بيانات تجريبية.\n\nهل أنت متأكد؟',
            confirmText: t('common.confirm'),
            cancelText: t('common.cancel')
        });
        if (!confirm1) {
            setShowAuditChoiceModal(false);
            return;
        }
        setShowAuditChoiceModal(false);
        setAuditLoading(true);
        setAuditStatus('loading');
        setAuditProgress(t('admin.scanningFirestore') || '🔍 جاري فحص Firestore...');
        try {
            logger.info('Starting Deep Audit Protocol', null, 'TenantsTab');
            setAuditProgress(t('admin.scanningFirestore') || '📊 جاري فحص Firestore...');
            const report = await executeDeepAudit();
            setAuditProgress(t('admin.auditCompleted') || '✅ اكتمل الفحص بنجاح!');
            if (report.summary.status === 'STERILE') {
                setAuditStatus('success');
                success(`✅ تم الفحص بنجاح!\n\n📊 الحالة: النظام نظيف 100%\n🗑️ تم حذف: ${report.summary.totalDeleted} عنصر`);
            } else if (report.summary.status === 'CONTAMINATED') {
                setAuditStatus('error');
                error(`⚠️ اكتمل الفحص مع تحذيرات\n\nتم حذف ${report.summary.totalDeleted} عنصر، لكن لا يزال هناك بيانات في النظام`);
            } else {
                setAuditStatus('error');
                error(t('admin.deepAuditFailed') || '❌ فشل الفحص');
            }
            await onRefresh();
            const deleted = await getDeletedManagers();
            setDeletedManagers(deleted); // ✅ تحديث قائمة المحذوفين بعد الفحص (تم مسح الأرشيف)
        } catch (err: any) {
            logger.error('Deep Audit error', err, 'TenantsTab');
            setAuditStatus('error');
            setAuditProgress(t('common.operationFailed') || '❌ فشل العملية');
            error(err.message || t('admin.deepAuditFailed'));
        } finally {
            setAuditLoading(false);
            setTimeout(() => {
                setAuditStatus('idle');
                setAuditProgress('');
            }, 3000);
        }
    };

    const handleConfirmPurge = async () => {
        if (resetCode.trim() !== 'RESET') {
            error(t('system.wrongResetCode'));
            return;
        }
        if (!user || user.role !== 'owner' || !user.id) {
            error('⚠️ خطأ: هذه العملية متاحة للمالك فقط.');
            return;
        }
        setShowPurgeConfirmModal(false);
        setResetCode('');
        setAuditLoading(true);
        setAuditStatus('loading');
        setAuditProgress(`☢️ ${t('system.purging')}`);
        try {
            logger.info('Initializing Nuclear Purge via Deep Audit', null, 'TenantsTab');
            setAuditProgress(`🔥 ${t('system.deletingAllData')}`);
            const report = await executeDeepAudit({ nuclearMode: true, ownerId: user.id });
            setAuditProgress(`✅ ${t('system.purgeCompleted')}`);
            setAuditStatus('success');
            haptic('success');
            playSound('success');
            await onRefresh();
            const deletedNow = await getDeletedManagers();
            setDeletedManagers(deletedNow); // ✅ عرض الحالة الفعلية بعد المسح (إن فشل حذف الأرشيف يبقى الظهور حتى تنشر القواعد)
            const hasArchiveError = report.firestore?.errors?.some((e: string) => e.includes('deleted_managers') || e.includes('صلاحيات'));
            if (hasArchiveError) {
                error(t('admin.deletedManagersPurgeFailed') || 'تم المسح لكن أرشيف المحذوفين لم يُمسح (صلاحيات). انشر القواعد: firebase deploy --only firestore:rules');
            }
            success(`${t('system.purgeSuccess')}\n\n${t('system.purgeSuccessDetails', { count: report.summary.totalDeleted })}`);
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err: any) {
            logger.error('Purge System error', err, 'TenantsTab');
            setAuditStatus('error');
            setAuditProgress(`❌ ${t('system.purgeFailed')}`);
            error(`${t('system.purgeFailed')}\n\n${err.message || 'خطأ غير معروف'}`);
            setTimeout(() => {
                setAuditStatus('idle');
                setAuditProgress('');
            }, 5000);
        } finally {
            setAuditLoading(false);
        }
    };

    return (
        <>
            {/* 📍 Contextual Help for Owner */}
            <CreateManagerHelp />

            <div className="w-full space-y-4 sm:space-y-6">
                {/* Header Section */}
                <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-6">
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{t('admin.tenantList')}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={onAddManager}
                                className="group relative w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 text-sm sm:text-base font-semibold overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.95) 69%, rgba(14, 165, 233, 0.95) 100%)',
                            border: '2px solid rgba(20, 184, 166, 0.4)',
                            color: '#ffffff',
                            boxShadow: '0 4px 16px rgba(20, 184, 166, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20, 184, 166, 1) 0%, rgba(14, 165, 233, 1) 100%)';
                            e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.6)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 184, 166, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20, 184, 166, 0.95) 69%, rgba(14, 165, 233, 0.95) 100%)';
                            e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.4)';
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(20, 184, 166, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                        >
                        {/* Shine effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                        <Plus className="w-5 h-5 sm:w-5 sm:h-5 flex-shrink-0 relative z-10" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }} />
                        <span className="relative z-10">{t('admin.addNewManager')}</span>
                            </button>
                            
                            {/* ✅ Deep Audit & Purge System Buttons - نفس حجم زر إضافة مدير */}
                            <button
                                onClick={() => setShowScanPasswordModal(true)}
                                disabled={auditLoading}
                                className={`flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border transition-all relative overflow-hidden text-sm sm:text-base font-semibold ${
                                    auditStatus === 'loading' 
                                        ? 'bg-blue-500/30 text-blue-300 border-blue-400/50 animate-pulse shadow-lg shadow-blue-500/30' 
                                        : auditStatus === 'success'
                                        ? 'bg-green-500/30 text-green-300 border-green-400/50 shadow-lg shadow-green-500/30'
                                        : auditStatus === 'error'
                                        ? 'bg-red-500/30 text-red-300 border-red-400/50 shadow-lg shadow-red-500/30'
                                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={auditProgress || (t('admin.fullSystemScanOrPurge') || 'المسح النووي وإعادة وضع المصنع')}
                            >
                                {auditStatus === 'loading' && (
                                    <span className="absolute inset-0 rounded-xl sm:rounded-2xl animate-ping bg-blue-500/20"></span>
                                )}
                                <div className="relative flex items-center gap-2">
                                    {auditLoading ? (
                                        <div className="flex items-center gap-2">
                                            <AdoraLoaderInline size={18} />
                                            <span className="text-sm sm:text-base font-semibold animate-pulse">{auditProgress || 'جاري المعالجة...'}</span>
                                        </div>
                                    ) : auditStatus === 'success' ? (
                                        <>
                                            <CheckCircle className="w-5 h-5 animate-bounce" />
                                            <span className="text-sm sm:text-base font-semibold">✅ اكتمل</span>
                                        </>
                                    ) : auditStatus === 'error' ? (
                                        <>
                                            <AlertTriangle className="w-5 h-5 animate-shake" />
                                            <span className="text-sm sm:text-base font-semibold">❌ فشل</span>
                                        </>
                                    ) : (
                                        <>
                                            <Shield className="w-5 h-5 flex-shrink-0" />
                                            <span className="hidden sm:inline">{t('admin.scanOrPurge') || 'المسح النووي وإعادة وضع المصنع'}</span>
                                            <span className="sm:hidden">🔍</span>
                                        </>
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* ✅ Filters - Mobile First, Full Width, Above Cards */}
                    <div className="w-full space-y-3">
                    {/* Filter Buttons - Responsive Grid for Mobile */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { id: 'all' as FilterType, label: t('common.all'), icon: Activity },
                            { id: 'active' as FilterType, label: t('admin.active'), icon: CheckCircle },
                            { id: 'suspended' as FilterType, label: t('admin.suspended'), icon: Pause },
                            { id: 'expired' as FilterType, label: t('admin.expired'), icon: AlertTriangle },
                            { id: 'expiring' as FilterType, label: t('admin.nearingExpiry'), icon: Clock },
                            { id: 'deleted' as FilterType, label: t('admin.deleted'), icon: Trash2 }
                        ].map(filter => {
                            const Icon = filter.icon;
                            const isActive = activeFilter === filter.id;
                            // ✅ FIX: {t('admin.deletedIdsList')}
                            const deletedTenantIds = new Set(deletedManagers.map((m: any) => m.tenantId || m.id));
                            const count = filter.id === 'all'
                                ? tenants.length
                                : filter.id === 'deleted'
                                    ? deletedManagers.length
                                    : filter.id === 'expiring'
                                        ? tenants.filter(t =>
                                            t.status !== 'deleted' &&
                                            !(t as any).isDeleted &&
                                            !deletedTenantIds.has(t.tenantId)
                                        ).length // ✅ FIX: استثناء المحذوفين بكل الطرق
                                        : tenants.filter(t => {
                                            if (filter.id === 'active') return t.status === 'active';
                                            if (filter.id === 'suspended') return t.status === 'suspended';
                                            if (filter.id === 'expired') {
                                                // Use daysUntilExpiry if available
                                                if (t.daysUntilExpiry !== undefined && t.daysUntilExpiry !== null) {
                                                    return t.daysUntilExpiry <= 0 || t.status === 'expired';
                                                }
                                                // Otherwise calculate
                                                try {
                                                    let expiry: Date;
                                                    if (t.licenseExpiryDate instanceof Date) {
                                                        expiry = t.licenseExpiryDate;
                                                    } else if (t.licenseExpiryDate && typeof t.licenseExpiryDate === 'object' && 'toDate' in t.licenseExpiryDate) {
                                                        expiry = (t.licenseExpiryDate as any).toDate();
                                                    } else if (typeof t.licenseExpiryDate === 'string') {
                                                        expiry = new Date(t.licenseExpiryDate);
                                                    } else {
                                                        expiry = new Date(t.licenseExpiryDate);
                                                    }
                                                    if (isNaN(expiry.getTime())) return t.status === 'expired';
                                                    const now = new Date();
                                                    now.setHours(0, 0, 0, 0);
                                                    expiry.setHours(0, 0, 0, 0);
                                                    return expiry < now || t.status === 'expired';
                                                } catch {
                                                    return t.status === 'expired';
                                                }
                                            }
                                            return false;
                                        }).length;

                            return (
                                <button
                                    key={filter.id}
                                    onClick={() => setActiveFilter(filter.id)}
                                    className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm w-full sm:w-auto flex-shrink-0 ${
                                        isActive
                                            ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/40 dark:border-teal-500/30 shadow-sm'
                                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-800/80'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span>{filter.label}</span>
                                    {count > 0 && (
                                        <span 
                                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                isActive
                                                    ? 'bg-teal-500/30 text-teal-700 dark:text-teal-400'
                                                    : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/80'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search by Name/Code - Mobile First, Full Width */}
                    <div className="relative w-full">
                        <Search 
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 z-10 text-slate-400 dark:text-slate-500" 
                        />
                        <input
                            id="tenant-search-input"
                            name="tenantSearch"
                            type="text"
                            placeholder={t('admin.searchByNameOrCode')}
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base shadow-sm transition-all bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-500/30 focus:bg-white dark:focus:bg-slate-800/80"
                        />
                    </div>
                </div>
                </div>

                {/* ✅ Empty State - Below Filters */}
                {filteredTenants.length === 0 && (
                    <div className="w-full flex items-center justify-center min-h-[200px]">
                        <p className="text-center text-slate-500 dark:text-white/40 py-6 sm:py-8 text-sm sm:text-base">
                            {searchCode || activeFilter !== 'all'
                                ? t('admin.noResults')
                                : t('admin.noTenants')}
                        </p>
                    </div>
                )}

                {/* ✅ Ultra-Compact Cards Container - Mobile First */}
                {filteredTenants.length > 0 && (
                    <div className="w-full space-y-2 sm:space-y-3">
                    {filteredTenants.map((tenant: TenantAnalytics & { isDeleted?: boolean }, index: number) => {
                        // ✅ Check if this is a deleted manager
                            const isDeletedManager = (tenant as any).isDeleted === true ||
                                tenant.status === 'deleted' ||
                                activeFilter === 'deleted';

                            const statusLabel =
                                isDeletedManager
                                    ? t('admin.deletedLicense')
                                    : tenant.status === 'active'
                                        ? t('admin.activeStatus')
                                        : tenant.status === 'suspended'
                                            ? t('admin.suspendedStatus')
                                            : t('admin.expiredStatus');

                            const statusClasses =
                                isDeletedManager
                                    ? 'bg-gray-200 dark:bg-gray-500/20 text-gray-600 dark:text-gray-300 border-gray-400 dark:border-gray-500/50'
                                    : tenant.status === 'active'
                                        ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-500'
                                        : tenant.status === 'suspended'
                                            ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500'
                                            : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-500';

                            // ✅ Ultra-Compact Professional Row Design - 2026 Best Practices
                            const cardClasses = isDeletedManager
                                ? 'bg-gradient-to-r from-red-50/30 via-gray-50/20 to-red-50/30 dark:from-slate-900/60 dark:via-slate-800/50 dark:to-slate-900/60 rounded-xl p-3 transition-all border border-dashed border-red-300/40 dark:border-red-500/20 relative overflow-hidden opacity-90 hover:opacity-100 shadow-sm hover:shadow-md dark:shadow-slate-900/30'
                                : 'bg-white dark:bg-slate-800/60 rounded-xl p-3 transition-all duration-200 border border-slate-200/80 dark:border-slate-700/50 shadow-sm hover:shadow-md hover:border-teal-400/50 dark:hover:border-teal-500/30 dark:shadow-slate-900/20';

                            return (
                                <div
                                    key={`${tenant.tenantId}-${index}-${isDeletedManager ? 'deleted' : 'active'}`}
                                    className={cardClasses}
                                >
                                    {isDeletedManager && (
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-400 via-red-500 to-red-400" />
                                    )}
                                    {/* صف منسق: شبكة على الشاشات المتوسطة+ */}
                                    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_auto_1fr_auto_auto_auto] md:items-center gap-y-3 md:gap-x-4 md:gap-y-0">
                                        {/* عمود 1: الاسم + الحالة */}
                                        <div className="min-w-0 flex flex-wrap items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                {tenant.tenantName}
                                            </h4>
                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded-md border ${statusClasses} flex items-center gap-1 font-semibold shrink-0`}
                                            >
                                                {isDeletedManager && <Trash2 className="w-3 h-3" />}
                                                {statusLabel}
                                            </span>
                                        </div>
                                        {/* عمود 2: المدير + الكود */}
                                        <div className="min-w-0 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate">{tenant.managerName || '—'}</span>
                                            {tenant.managerCode && (
                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px] font-bold border border-slate-200 dark:border-slate-600 shrink-0">
                                                    {tenant.managerCode}
                                                </span>
                                            )}
                                        </div>
                                        {/* عمود 3: الإحصائيات (فروع · موظفين · غرف · طلبات) */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400" title={t('admin.totalBranches') || 'فروع'}>
                                                <Building2 className="w-3 h-3 text-blue-500" />
                                                <b className="text-slate-900 dark:text-white tabular-nums">{tenant.totalBranches}</b>
                                            </span>
                                            <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400" title={t('admin.totalEmployees') || 'موظفين'}>
                                                <Users className="w-3 h-3 text-purple-500" />
                                                <b className="text-slate-900 dark:text-white tabular-nums">{tenant.totalEmployees}</b>
                                            </span>
                                            <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400" title={t('admin.rooms') || 'غرف'}>
                                                <DoorOpen className="w-3 h-3 text-teal-500" />
                                                <b className="text-slate-900 dark:text-white tabular-nums">{tenant.totalRooms ?? 0}</b>
                                            </span>
                                            <span className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400" title={t('admin.requests') || 'طلبات'}>
                                                <Activity className="w-3 h-3 text-green-500" />
                                                <b className="text-slate-900 dark:text-white tabular-nums">{tenant.totalRequests ?? 0}</b>
                                            </span>
                                        </div>
                                        {/* عمود 4: الخطة */}
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <CreditCard className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                                            <span className="font-semibold text-slate-900 dark:text-white capitalize">
                                                {tenant.plan === 'enterprise' ? 'Enterprise' : tenant.plan === 'pro' ? 'Pro' : 'Basic'}
                                            </span>
                                        </div>
                                        {/* عمود 5: المتبقي */}
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <Calendar className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                                            <span className={`font-semibold tabular-nums ${tenant.daysUntilExpiry <= 7 ? 'text-red-600 dark:text-red-400' : tenant.daysUntilExpiry <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                                                {tenant.daysUntilExpiry} يوم
                                            </span>
                                        </div>
                                        {/* عمود 6: الإجراءات */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                                            {isDeletedManager ? (
                                                // Restore button for deleted managers (in any filter)
                                                <button
                                                    onClick={async () => {
                                                        const deletedManager = deletedManagers.find((m: any) =>
                                                            (m.tenantId || m.id) === tenant.tenantId
                                                        );
                                                        if (!deletedManager) {
                                                            error(t('admin.managerNotFound'));
                                                            return;
                                                        }
                                                        const confirmed = await customConfirm({
                                                            type: 'info',
                                                            title: t('admin.restoreConfirm'),
                                                            message: t('admin.restoreConfirmMessage'),
                                                            confirmText: t('admin.restore'),
                                                            cancelText: t('common.cancel')
                                                        });
                                                        if (!confirmed) {
                                                            return;
                                                        }
                                                        setProcessing(tenant.tenantId);
                                                        try {
                                                            await restoreManager(deletedManager.id);
                                                            success(t('admin.managerRestored'));
                                                            await onRefresh();
                                                            const updatedDeleted = await getDeletedManagers();
                                                            setDeletedManagers(updatedDeleted);
                                                        } catch (err: any) {
                                                            error(err.message || t('admin.errorRestoring'));
                                                        } finally {
                                                            setProcessing(null);
                                                        }
                                                    }}
                                                    disabled={processing === tenant.tenantId}
                                                    className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 hover:border-green-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-xs sm:text-sm font-medium min-w-[32px] sm:min-w-[auto]"
                                                    title={t('admin.restoreManager')}
                                                >
                                                    {processing === tenant.tenantId ? (
                                                        <AdoraLoaderInline size={12} />
                                                    ) : (
                                                        <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                    )}
                                                    <span className="text-sm font-medium">{t('admin.restore')}</span>
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => onViewDetails?.(tenant)}
                                                        className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all duration-200 shadow-sm hover:shadow-md text-xs sm:text-sm font-medium min-w-[32px] sm:min-w-[auto]"
                                                        title={t('common.viewFullDetails') || 'عرض التفاصيل الكاملة'}
                                                    >
                                                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                        <span className="hidden sm:inline text-sm font-medium">{t('common.view') || 'عرض'}</span>
                                                    </button>
                                                    {/* ✅ Check if manager is deleted before showing action buttons */}
                                                    {(() => {
                                                        const isDeleted = deletedManagers.some((m: any) =>
                                                            (m.tenantId || m.id) === tenant.tenantId
                                                        );

                                                        if (isDeleted) {
                                                            // Manager is deleted - show restore button instead
                                                            return (
                                                                <button
                                                                    onClick={async () => {
                                                                        const deletedManager = deletedManagers.find((m: any) =>
                                                                            (m.tenantId || m.id) === tenant.tenantId
                                                                        );
                                                                        if (!deletedManager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        const confirmed = await customConfirm({
                                                                            type: 'info',
                                                                            title: t('owner.confirmRestore'),
                                                                            message: t('owner.confirmRestoreMessage'),
                                                                            confirmText: t('owner.restore'),
                                                                            cancelText: t('common.cancel')
                                                                        });
                                                                        if (!confirmed) {
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            await restoreManager(deletedManager.id);
                                                                            success(t('admin.managerRestored'));
                                                                            await onRefresh();
                                                                            const updatedDeleted = await getDeletedManagers();
                                                                            setDeletedManagers(updatedDeleted);
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.errorRestoring'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 hover:border-green-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-xs sm:text-sm font-medium min-w-[32px] sm:min-w-[auto]"
                                                                    title={t('admin.restoreManager')}
                                                                >
                                                                    {processing === tenant.tenantId ? (
                                                                        <AdoraLoaderInline size={14} />
                                                                    ) : (
                                                                        <Upload className="w-4 h-4" />
                                                                    )}
                                                                    <span className="hidden sm:inline text-sm font-medium">{t('admin.restore')}</span>
                                                                </button>
                                                            );
                                                        }

                                                        // Manager is not deleted - show normal action buttons
                                                        return (
                                                            <>
                                                                <button
                                                                    onClick={async () => {
                                                                        const managers = await getAllManagers();
                                                                        const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                                        if (!manager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            await toggleLicenseStatus(manager.id, tenant.tenantId, tenant.status === 'active');
                                                                            success(tenant.status === 'active' ? t('admin.managerSuspended') : t('admin.managerActivated'));
                                                                            await onRefresh();
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.addError'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className={`flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-xs sm:text-sm font-medium min-w-[32px] sm:min-w-[auto] ${
                                                                        tenant.status === 'active'
                                                                            ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/30 hover:border-yellow-500/50'
                                                                            : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 hover:border-green-500/50'
                                                                    }`}
                                                                    title={tenant.status === 'active' ? t('owner.suspend') : t('owner.activate')}
                                                                >
                                                                    {processing === tenant.tenantId ? (
                                                                        <AdoraLoaderInline size={12} />
                                                                    ) : tenant.status === 'active' ? (
                                                                        <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                                    ) : (
                                                                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                                    )}
                                                                    <span className="hidden sm:inline text-sm font-medium">
                                                                        {tenant.status === 'active' ? t('owner.suspend') : t('owner.activate')}
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const managers = await getAllManagers();
                                                                        const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                                        if (!manager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            const systemSettings = await getSystemSettings();
                                                                            const defaultPrice = systemSettings.defaultSubscriptionPrice || 0;
                                                                            const subscription = await getSubscription(tenant.tenantId);
                                                                            const currentPrice = subscription?.pricePerMonth || 0;
                                                                            const result = await renewLicense(manager.id, tenant.tenantId, 1, currentPrice, defaultPrice);
                                                                            if (result.warning) {
                                                                                await customConfirm({
                                                                                    title: t('common.warning'),
                                                                                    message: result.warning,
                                                                                    confirmText: t('common.ok'),
                                                                                    showCancel: false,
                                                                                    type: 'warning'
                                                                                });
                                                                            }
                                                                            const renewalPrice = defaultPrice > 0 ? defaultPrice : currentPrice;
                                                                            await renewSubscription(tenant.tenantId, 'yearly', renewalPrice);
                                                                            if (renewalPrice > 0 && subscription) {
                                                                                const invoiceId = await createInvoice({
                                                                                    tenantId: tenant.tenantId,
                                                                                    subscriptionId: subscription.id,
                                                                                    amount: renewalPrice,
                                                                                    currency: 'SAR',
                                                                                    status: 'paid',
                                                                                    issueDate: new Date(),
                                                                                    dueDate: new Date(),
                                                                                    paidDate: new Date(),
                                                                                    items: [{
                                                                                        description: 'تجديد اشتراك سنوي',
                                                                                        quantity: 1,
                                                                                        price: renewalPrice
                                                                                    }],
                                                                                    paymentMethod: 'cash',
                                                                                    notes: 'تجديد تلقائي من قبل المالك'
                                                                                });

                                                                                await recordPayment({
                                                                                    tenantId: tenant.tenantId,
                                                                                    invoiceId: invoiceId,
                                                                                    amount: renewalPrice,
                                                                                    currency: 'SAR',
                                                                                    method: 'cash',
                                                                                    status: 'completed',
                                                                                    paidAt: new Date(),
                                                                                    notes: 'تجديد تلقائي'
                                                                                });
                                                                            }

                                                                            success(t('admin.subscriptionRenewed'));
                                                                            // Refresh data to update statistics, billing cards, and revenue
                                                                            await onRefresh();
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.errorRenewing'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-xs sm:text-sm font-medium min-w-[32px] sm:min-w-[auto]"
                                                                    title={t('admin.renewSubscriptionYear') || 'تجديد الاشتراك (سنة)'}
                                                                >
                                                                    {processing === tenant.tenantId ? (
                                                                        <AdoraLoaderInline size={12} />
                                                                    ) : (
                                                                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                                    )}
                                                                    <span className="hidden sm:inline text-sm font-medium">تجديد</span>
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const confirmed = await customConfirm({
                                                                            type: 'danger',
                                                                            title: t('admin.confirmDelete'),
                                                                            message: t('admin.deleteManagerConfirm', { name: tenant.managerName || tenant.tenantName }),
                                                                            confirmText: t('admin.delete'),
                                                                            cancelText: t('common.cancel')
                                                                        });
                                                                        if (!confirmed) {
                                                                            return;
                                                                        }
                                                                        const managers = await getAllManagers();
                                                                        const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                                        if (!manager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            await softDeleteManager(manager.id, tenant.tenantId);
                                                                            success(t('admin.managerDeletedSuccess'));
                                                                            // Refresh data to update statistics
                                                                            await onRefresh();
                                                                            const deleted = await getDeletedManagers();
                                                                            setDeletedManagers(deleted);
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.deleteError'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md text-xs sm:text-sm font-medium min-w-[32px] sm:min-w-[auto]"
                                                                    title={t('admin.deletePermanent')}
                                                                >
                                                                    {processing === tenant.tenantId ? (
                                                                        <AdoraLoaderInline size={12} />
                                                                    ) : (
                                                                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                                    )}
                                                                    <span className="hidden sm:inline text-sm font-medium">{t('admin.delete')}</span>
                                                                </button>
                                                            </>
                                                        );
                                                    })()}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
            </div>

            {/* Manager Details Modal */}
            {selectedTenant && managerDetails && (
                <ManagerDetailsModal
                    tenant={selectedTenant}
                    managerDetails={managerDetails}
                    loading={loadingDetails}
                    onClose={() => {
                        setSelectedTenant(null);
                        setManagerDetails(null);
                    }}
                />
            )}

            {/* ✅ Deep Audit & Purge System Modals */}
            {/* Scan Password Modal */}
            <UnifiedModal
                isOpen={showScanPasswordModal}
                onClose={() => {
                    if (!auditLoading) {
                        setShowScanPasswordModal(false);
                        setScanPassword('');
                    }
                }}
                title={t('admin.scanPasswordTitle') || '🔐 كلمة المرور'}
                subtitle={t('admin.scanPasswordSubtitle') || 'أدخل كلمة المرور للوصول إلى خيارات الفحص والمسح'}
                icon={<Shield className="w-6 h-6 text-blue-400" />}
                size="md"
                showCloseButton={!auditLoading}
                closeOnBackdrop={!auditLoading}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            {t('admin.password') || 'كلمة المرور'}
                        </label>
                        <input
                            type="password"
                            value={scanPassword}
                            onChange={(e) => setScanPassword(e.target.value)}
                            placeholder={t('admin.enterPassword') || 'أدخل كلمة المرور'}
                            className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            dir="ltr"
                            disabled={auditLoading}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && scanPassword.trim()) {
                                    handleScanPasswordConfirm();
                                }
                            }}
                        />
                    </div>
                    <ModalActions
                        onCancel={() => {
                            if (!auditLoading) {
                                setShowScanPasswordModal(false);
                                setScanPassword('');
                            }
                        }}
                        onConfirm={handleScanPasswordConfirm}
                        cancelText={t('common.cancel')}
                        confirmText={t('common.confirm')}
                        confirmVariant="primary"
                        loading={auditLoading}
                        disabled={!scanPassword.trim() || auditLoading}
                    />
                </div>
            </UnifiedModal>

            {/* Audit Choice Modal */}
            <UnifiedModal
                isOpen={showAuditChoiceModal}
                onClose={() => {
                    if (!auditLoading) {
                        setShowAuditChoiceModal(false);
                    }
                }}
                title={t('admin.auditChoiceTitle') || 'اختر العملية'}
                subtitle={t('admin.auditChoiceSubtitle') || 'اختر بين فحص النظام أو مسح كامل'}
                icon={<Shield className="w-6 h-6 text-blue-400" />}
                size="md"
                showCloseButton={!auditLoading}
                closeOnBackdrop={!auditLoading}
            >
                <div className="space-y-3">
                    <button
                        onClick={handleDeepAudit}
                        disabled={auditLoading}
                        className="w-full px-4 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Shield className="w-5 h-5" />
                        <span className="font-medium">{t('admin.deepAudit') || '🔍 فحص النظام'}</span>
                    </button>
                    <button
                        onClick={() => {
                            setShowAuditChoiceModal(false);
                            setShowPurgeConfirmModal(true);
                        }}
                        disabled={auditLoading}
                        className="w-full px-4 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-medium">{t('admin.purgeSystem') || '☢️ مسح النظام'}</span>
                    </button>
                </div>
            </UnifiedModal>

            {/* Purge Confirm Modal */}
            <UnifiedModal
                isOpen={showPurgeConfirmModal}
                onClose={() => {
                    if (!auditLoading) {
                        setShowPurgeConfirmModal(false);
                        setResetCode('');
                    }
                }}
                title={t('admin.purgeConfirmTitle') || '☢️ تأكيد المسح الكامل'}
                subtitle={t('admin.purgeConfirmSubtitle') || 'هذه العملية ستحذف جميع البيانات نهائياً. اكتب RESET للتأكيد.'}
                icon={<AlertTriangle className="w-6 h-6 text-red-400" />}
                size="md"
                showCloseButton={!auditLoading}
                closeOnBackdrop={!auditLoading}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            {t('admin.resetCode') || 'كود التأكيد: RESET'}
                        </label>
                        <input
                            type="text"
                            value={resetCode}
                            onChange={(e) => setResetCode(e.target.value)}
                            placeholder="RESET"
                            className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all font-mono"
                            dir="ltr"
                            disabled={auditLoading}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && resetCode.trim() === 'RESET') {
                                    handleConfirmPurge();
                                }
                            }}
                        />
                    </div>
                    <ModalActions
                        onCancel={() => {
                            if (!auditLoading) {
                                setShowPurgeConfirmModal(false);
                                setResetCode('');
                            }
                        }}
                        onConfirm={handleConfirmPurge}
                        cancelText={t('common.cancel')}
                        confirmText={t('admin.confirmPurge') || 'تأكيد المسح'}
                        confirmVariant="danger"
                        loading={auditLoading}
                        disabled={resetCode.trim() !== 'RESET' || auditLoading}
                    />
                </div>
            </UnifiedModal>
        </>
    );
};

const SettingsTab: React.FC<{
    systemSettings: SystemSettings;
    onSave: (updates: Partial<SystemSettings>) => void;
    saving: boolean;
    features: SystemSettings['features'];
    onToggleFeature: (feature: keyof SystemSettings['features'], enabled: boolean) => void;
}> = ({ systemSettings, onSave, saving, features, onToggleFeature }) => {
    const { t } = useTranslation();
    const [isFeaturesCollapsed, setIsFeaturesCollapsed] = useState(true);
    const [isCompanyInfoCollapsed, setIsCompanyInfoCollapsed] = useState(true);

    // ✅ FIXED: Initialize from localStorage first, then systemSettings
    const [localPrice, setLocalPrice] = useState<number>(() => {
        // Check localStorage for cached settings
        const localData = localStorage.getItem('adora_system_settings');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (parsed.defaultSubscriptionPrice !== undefined) {
                    return parsed.defaultSubscriptionPrice;
                }
            } catch { }
        }
        return systemSettings.defaultSubscriptionPrice ?? 0;
    });
    const [localTax, setLocalTax] = useState<number>(() => {
        const localData = localStorage.getItem('adora_system_settings');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (parsed.defaultTaxRate !== undefined) {
                    return parsed.defaultTaxRate;
                }
            } catch { }
        }
        return systemSettings.defaultTaxRate ?? 15;
    });
    const [localTwoYearDiscount, setLocalTwoYearDiscount] = useState<number>(() => {
        const localData = localStorage.getItem('adora_system_settings');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (parsed.twoYearDiscountRate !== undefined) {
                    return parsed.twoYearDiscountRate;
                }
            } catch { }
        }
        return systemSettings.twoYearDiscountRate ?? 0;
    });

    // ✅ Display values are now directly from local state
    const displayPrice = localPrice;
    const displayTax = localTax;
    const displayTwoYearDiscount = localTwoYearDiscount;

    // ✅ Sync from systemSettings if it gets updated externally (but don't overwrite user edits)
    const prevSettingsRef = useRef({ price: systemSettings.defaultSubscriptionPrice, tax: systemSettings.defaultTaxRate, discount: systemSettings.twoYearDiscountRate });
    useEffect(() => {
        const prevPrice = prevSettingsRef.current.price;
        const prevTax = prevSettingsRef.current.tax;
        const prevDiscount = prevSettingsRef.current.discount;

        // Only update if systemSettings actually changed (not on initial mount)
        if (systemSettings.defaultSubscriptionPrice !== prevPrice && systemSettings.defaultSubscriptionPrice !== undefined) {
            setLocalPrice(systemSettings.defaultSubscriptionPrice);
        }
        if (systemSettings.defaultTaxRate !== prevTax && systemSettings.defaultTaxRate !== undefined) {
            setLocalTax(systemSettings.defaultTaxRate);
        }
        if (systemSettings.twoYearDiscountRate !== prevDiscount && systemSettings.twoYearDiscountRate !== undefined) {
            setLocalTwoYearDiscount(systemSettings.twoYearDiscountRate);
        }

        prevSettingsRef.current = { price: systemSettings.defaultSubscriptionPrice, tax: systemSettings.defaultTaxRate, discount: systemSettings.twoYearDiscountRate };
    }, [systemSettings.defaultSubscriptionPrice, systemSettings.defaultTaxRate, systemSettings.twoYearDiscountRate]);

    // ✅ Local state for company information
    const [localCompanyName, setLocalCompanyName] = useState(systemSettings.companyName ?? '');
    const [localCompanyTaxNumber, setLocalCompanyTaxNumber] = useState(systemSettings.companyTaxNumber ?? '');
    const [localCompanyAddress, setLocalCompanyAddress] = useState(systemSettings.companyAddress ?? '');
    const [localCommercialRegistration, setLocalCommercialRegistration] = useState(systemSettings.commercialRegistrationNumber ?? '');
    const [localContactPhone, setLocalContactPhone] = useState(systemSettings.contactPhone ?? '');
    const [localContactEmail, setLocalContactEmail] = useState(systemSettings.contactEmail ?? '');
    const [localContactWebsite, setLocalContactWebsite] = useState(systemSettings.contactWebsite ?? '');

    // ✅ Sync company info from systemSettings when it loads/updates (e.g. from Firebase after mount)
    useEffect(() => {
        setLocalCompanyName(systemSettings.companyName ?? '');
        setLocalCompanyTaxNumber(systemSettings.companyTaxNumber ?? '');
        setLocalCompanyAddress(systemSettings.companyAddress ?? '');
        setLocalCommercialRegistration(systemSettings.commercialRegistrationNumber ?? '');
        setLocalContactPhone(systemSettings.contactPhone ?? '');
        setLocalContactEmail(systemSettings.contactEmail ?? '');
        setLocalContactWebsite(systemSettings.contactWebsite ?? '');
    }, [
        systemSettings.companyName,
        systemSettings.companyTaxNumber,
        systemSettings.companyAddress,
        systemSettings.commercialRegistrationNumber,
        systemSettings.contactPhone,
        systemSettings.contactEmail,
        systemSettings.contactWebsite
    ]);

    // Feature Labels
    const featureLabels: Record<string, string> = {
        qrCodeGuestPortal: 'بوابة النزيل (QR)',
        pointsSystem: 'نظام النقاط',
        gamification: 'الشارات والرتب',
        shiftNotes: 'ملاحظات الشيفت',
        scheduledTasks: 'المهام المجدولة',
        aiAssistant: 'المساعد الذكي',
        calendarSync: 'مزامنة التقويم',
        inventoryManagement: 'إدارة المخزون',
        procurementSystem: 'نظام المشتريات',
        laundryManagement: 'إدارة المغسلة',
        whatsappIntegration: 'تكامل واتساب',
        emailNotifications: 'إشعارات البريد',
        smsNotifications: 'إشعارات SMS'
    };

    const featureDescriptions: Record<string, string> = {
        qrCodeGuestPortal: t('admin.featureDescriptions.qrCodeGuestPortal'),
        pointsSystem: t('admin.featureDescriptions.pointsSystem'),
        gamification: t('admin.featureDescriptions.gamification'),
        shiftNotes: t('admin.featureDescriptions.shiftNotes'),
        scheduledTasks: t('admin.featureDescriptions.scheduledTasks'),
        aiAssistant: 'سوف يظهر زر المساعد الصوتي في المشروع للمشتركين. يمكن للموظفين التفاعل مع النظام عبر الأوامر الصوتية.',
        calendarSync: 'مزامنة التقويم مع أنظمة خارجية. يسمح بتنسيق الأحداث والمواعيد مع التقويمات الأخرى.',
        inventoryManagement: 'نظام إدارة المخزون الكامل. تتبع المنتجات، الكميات، والحركات المخزنية.',
        procurementSystem: 'نظام إدارة المشتريات. تتبع طلبات الشراء، الموافقات، والاستلام.',
        laundryManagement: 'نظام إدارة المغسلة. تتبع غسيل الملابس، التسليم، والاستلام.',
        whatsappIntegration: 'تكامل مع واتساب لإرسال الإشعارات والرسائل. يسمح بالتواصل مع العملاء والموظفين عبر واتساب.',
        emailNotifications: 'إرسال الإشعارات عبر البريد الإلكتروني. تنبيهات تلقائية للأحداث المهمة.',
        smsNotifications: 'إرسال الإشعارات عبر الرسائل النصية (SMS). تنبيهات فورية للأحداث الحرجة.'
    };

    // ✅ FIX: Fixed order to prevent reordering when toggling
    const featureOrder: (keyof SystemSettings['features'])[] = [
        'qrCodeGuestPortal',
        'pointsSystem',
        'gamification',
        'shiftNotes',
        'scheduledTasks',
        'aiAssistant',
        'calendarSync',
        'inventoryManagement',
        'procurementSystem',
        'laundryManagement',
        'whatsappIntegration',
        'emailNotifications',
        'smsNotifications'
    ];

    return (
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            {/* General Settings Section - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">{t('admin.generalSettings')}</h3>
                <div className="space-y-4 sm:space-y-6">
                    {/* Default Subscription Price */}
                    <div className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                {t('admin.subscriptionPrice')}
                            </label>
                            <p className="text-xs text-white/50 mb-3 leading-relaxed">
                                {t('admin.subscriptionPriceNote')}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 items-end">
                                <div className="w-full">
                                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                                        سعر الاشتراك (ر.س)
                                    </label>
                                    <input
                                        id="subscription-price"
                                        name="subscriptionPrice"
                                        type="number"
                                        min="0"
                                        value={displayPrice}
                                        onChange={(e) => {
                                            const newPrice = parseFloat(e.target.value) || 0;
                                            setLocalPrice(newPrice);
                                        }}
                                        onInput={(e) => {
                                            // ✅ Also handle onInput for browser automation compatibility
                                            const newPrice = parseFloat((e.target as HTMLInputElement).value) || 0;
                                            setLocalPrice(newPrice);
                                        }}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                        placeholder={t('common.examplePrice') || 'مثال: 1000'}
                                    />
                                </div>

                                <div className="w-full">
                                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                                        نسبة الضريبة (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={displayTax}
                                        onChange={(e) => {
                                            const newTax = parseFloat(e.target.value);
                                            setLocalTax(isNaN(newTax) ? 0 : newTax);
                                        }}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                        placeholder={t('admin.discountPlaceholder') || '15'}
                                    />
                                </div>

                                <div className="w-full">
                                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                                        خصم السنتين (%)
                                    </label>
                                    <input
                                        id="subscription-discount"
                                        name="subscriptionDiscount"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={displayTwoYearDiscount}
                                        onChange={(e) => {
                                            const newDiscount = parseFloat(e.target.value);
                                            setLocalTwoYearDiscount(isNaN(newDiscount) ? 0 : newDiscount);
                                        }}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                        placeholder={t('admin.discountPlaceholder2') || '5'}
                                    />
                                </div>
                            </div>
                            
                            {/* Helper text for discount */}
                            {displayTwoYearDiscount > 0 && (
                                <p className="text-xs text-white/50 mt-2 flex items-center gap-1.5">
                                    <span className="text-teal-400">ℹ️</span>
                                    سيتم تطبيق خصم {displayTwoYearDiscount}% تلقائياً عند اختيار اشتراك سنتين
                                </p>
                            )}

                            <div className="flex justify-end mt-4">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => {
                                        onSave({
                                            defaultSubscriptionPrice: displayPrice,
                                            defaultTaxRate: displayTax,
                                            twoYearDiscountRate: displayTwoYearDiscount
                                        });
                                    }}
                                    className="w-full sm:w-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl bg-blue-500 text-white text-xs sm:text-sm font-semibold hover:bg-blue-600 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <AdoraLoaderInline size={16} />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {t('common.save')}
                                </button>
                            </div>

                            {/* Calculated summary */}
                            {displayPrice > 0 && (
                                <div className="mt-3 text-xs text-white/60 space-y-1 bg-gradient-to-br from-blue-500/10 via-teal-500/10 to-purple-500/10 rounded-xl p-4 border-2 border-teal-500/30 shadow-lg shadow-teal-500/20 backdrop-blur-sm">
                                    {(() => {
                                        const total = displayPrice;
                                        const taxRate = displayTax / 100;
                                        // نفترض أن السعر شامل الضريبة
                                        const basePrice = taxRate > 0 ? total / (1 + taxRate) : total;
                                        const taxAmount = total - basePrice;
                                        
                                        // ✅ Calculate 2-year price with discount and tax
                                        const twoYearBase = total * 2;
                                        const twoYearDiscountAmount = displayTwoYearDiscount > 0 ? (twoYearBase * displayTwoYearDiscount) / 100 : 0;
                                        const twoYearAfterDiscount = twoYearBase - twoYearDiscountAmount;
                                        
                                        // Calculate tax on discounted price
                                        const twoYearBaseBeforeTax = taxRate > 0 ? twoYearAfterDiscount / (1 + taxRate) : twoYearAfterDiscount;
                                        const twoYearTaxAmount = twoYearAfterDiscount - twoYearBaseBeforeTax;
                                        
                                        return (
                                            <>
                                                <p className="text-[11px]">
                                                    السعر قبل الضريبة: <span className="text-white/90">{Math.round(basePrice).toLocaleString()} ر.س</span>
                                                </p>
                                                <p className="text-[11px]">
                                                    قيمة الضريبة ({systemSettings.defaultTaxRate ?? 15}%):{' '}
                                                    <span className="text-white/90">{Math.round(taxAmount).toLocaleString()} ر.س</span>
                                                </p>
                                                <p className="text-[11px]">
                                                    إجمالي الاشتراك بعد الضريبة:{' '}
                                                    <span className="text-primary-500 font-semibold">
                                                        {Math.round(total).toLocaleString()} ر.س
                                                    </span>
                                                </p>
                                                {displayTwoYearDiscount > 0 && (
                                                    <>
                                                        <div className="border-t-2 border-primary-500/30 my-3 pt-3 mt-3 bg-primary-500/5 rounded-lg p-3 -mx-1">
                                                            <p className="text-primary-500 font-semibold mb-2 text-xs flex items-center gap-2">
                                                                <span className="text-base">✨</span>
                                                                الاشتراك لسنتين (بعد الخصم):
                                                            </p>
                                                            <p className="text-[11px]">
                                                                السعر الأصلي (سنتين): <span className="text-white/90">{Math.round(twoYearBase).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                خصم {displayTwoYearDiscount}%: <span className="text-red-400">-{Math.round(twoYearDiscountAmount).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                السعر بعد الخصم (قبل الضريبة): <span className="text-white/90">{Math.round(twoYearBaseBeforeTax).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                قيمة الضريبة ({systemSettings.defaultTaxRate ?? 15}%): <span className="text-white/90">{Math.round(twoYearTaxAmount).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                الإجمالي النهائي (بعد الخصم + الضريبة):{' '}
                                                                <span className="text-primary-500 font-semibold">
                                                                    {Math.round(twoYearAfterDiscount).toLocaleString()} ر.س
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ Company Information Section - Collapsible - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                {/* Header - Clickable */}
                <div
                    onClick={() => setIsCompanyInfoCollapsed(!isCompanyInfoCollapsed)}
                    className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/10 flex-shrink-0">
                            <FileText className="w-4 h-4 text-teal-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">معلومات الشركة (للمطبوعات)</h3>
                            <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                                {t('admin.infoAppearsInAllPrints')}
                            </p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isCompanyInfoCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-slate-50 dark:bg-slate-800/60 ${isCompanyInfoCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 sm:p-4 lg:p-6">
                        <div className="space-y-3 sm:space-y-4">
                            {/* Company Name */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    اسم الشركة *
                                </label>
                                <input
                                    id="company-name"
                                    name="companyName"
                                    type="text"
                                    value={localCompanyName}
                                    onChange={(e) => setLocalCompanyName(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    placeholder={t('common.exampleCompanyName') || 'مثال: شركة أدورا لإدارة الفنادق'}
                                />
                            </div>

                            {/* Tax Number */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    الرقم الضريبي *
                                </label>
                                <input
                                    id="company-tax-number"
                                    name="companyTaxNumber"
                                    type="text"
                                    value={localCompanyTaxNumber}
                                    onChange={(e) => setLocalCompanyTaxNumber(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    placeholder={t('common.exampleTaxNumber') || 'مثال: 302003322600003'}
                                />
                            </div>

                            {/* Commercial Registration */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    {t('admin.commercialRegisterNumber')} *
                                </label>
                                <input
                                    id="commercial-registration"
                                    name="commercialRegistration"
                                    type="text"
                                    value={localCommercialRegistration}
                                    onChange={(e) => setLocalCommercialRegistration(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    placeholder={t('owner.exampleCommercialRegistration') || 'مثال: 4030284941'}
                                />
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    عنوان الشركة *
                                </label>
                                <textarea
                                    id="company-address"
                                    name="companyAddress"
                                    value={localCompanyAddress}
                                    onChange={(e) => setLocalCompanyAddress(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base resize-none"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    placeholder={t('owner.exampleCompanyAddress') || 'مثال: جدة - الرويس، شارع الجزيرة بجوار الأطباء المتحدون'}
                                />
                            </div>

                            {/* Contact Phone */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    أرقام التواصل (هاتف) *
                                </label>
                                <input
                                    id="contact-phone"
                                    name="contactPhone"
                                    type="text"
                                    value={localContactPhone}
                                    onChange={(e) => setLocalContactPhone(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    placeholder={t('owner.exampleContactPhone') || 'مثال: +966 12 6076060، +966 570707121'}
                                />
                            </div>

                            {/* Contact Email */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    البريد الإلكتروني
                                </label>
                                <input
                                    id="contact-email"
                                    name="contactEmail"
                                    type="email"
                                    value={localContactEmail}
                                    onChange={(e) => setLocalContactEmail(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    placeholder={t('owner.exampleContactEmail') || 'مثال: info@adora.com'}
                                />
                            </div>

                            {/* Contact Website */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    الموقع الإلكتروني
                                </label>
                                <input
                                    id="contact-website"
                                    name="contactWebsite"
                                    type="url"
                                    value={localContactWebsite}
                                    onChange={(e) => setLocalContactWebsite(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    placeholder={t('owner.exampleWebsite') || 'مثال: https://www.adora.com'}
                                />
                            </div>

                            {/* Save Button */}
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                    onSave({
                                        companyName: localCompanyName,
                                        companyTaxNumber: localCompanyTaxNumber,
                                        companyAddress: localCompanyAddress,
                                        commercialRegistrationNumber: localCommercialRegistration,
                                        contactPhone: localContactPhone,
                                        contactEmail: localContactEmail,
                                        contactWebsite: localContactWebsite
                                    });
                                }}
                                className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <AdoraLoaderInline size={16} />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {t('admin.saveCompanyInfo')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Management Section - Collapsible - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                {/* Header - Clickable */}
                <div
                    onClick={() => setIsFeaturesCollapsed(!isFeaturesCollapsed)}
                    className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">إدارة الميزات</h3>
                            <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                                تفعيل أو إيقاف الميزات على مستوى النظام. عند إيقاف ميزة، ستختفي من جميع الفروع تلقائياً.
                            </p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isFeaturesCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-slate-50 dark:bg-slate-800/60 ${isFeaturesCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 sm:p-4 lg:p-6">
                        <div className="space-y-3 sm:space-y-4">
                            {featureOrder.map((key) => {
                                if (key === 'experimentalFeatures') return null;
                                const safeFeatures = features ?? {};
                                const enabled = safeFeatures[key] as boolean;
                                const description = featureDescriptions[key] || 'ميزة متاحة في النظام';
                                return (
                                    <div
                                        key={key}
                                        className="flex items-start justify-between p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl hover:bg-white/10 transition-all gap-3 sm:gap-4"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-1">
                                                <h4 className="font-medium text-white text-sm sm:text-base">{featureLabels[key] || key}</h4>
                                                <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${enabled
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                                                    }`}>
                                                    {enabled ? t('owner.enabled') : t('owner.disabled')}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-white/50 leading-relaxed mt-2">{description}</p>
                                        </div>
                                        <button
                                            onClick={() => onToggleFeature(key, !enabled)}
                                            disabled={saving}
                                            className={`relative w-12 h-7 sm:w-14 sm:h-8 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-green-500' : 'bg-gray-600'
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 left-0.5 sm:top-1 sm:left-1 w-6 h-6 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5 sm:translate-x-6' : ''
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ إخفاء: إعدادات التبويبات الأفقية — غير مستخدم */}

            {/* ✅ Dynamic Platform Branding Section - Logo & Theme */}
            <DynamicBrandingSection />

            {/* ✅ Developer Branding Section - For Forgot Code & Support Links */}
                            <DeveloperBrandingSection onSettingsUpdate={(settings) => {
                                // Update parent SettingsTab's systemSettings via onSave
                                onSave(settings);
                            }} />
        </div>
    );
};

// ✅ Dynamic Platform Branding Component (Logo + Theme Color)
const DynamicBrandingSection: React.FC = () => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(true); // ✅ Collapsed by default
    const [logoUrl, setLogoUrl] = useState(localStorage.getItem('adora_platform_logo') || '/adora-logo.png');
    const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('adora_primary_color') || '#14b8a6');
    const [secondaryColor, setSecondaryColor] = useState(localStorage.getItem('adora_secondary_color') || '#06b6d4');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const presetColors = [
        { name: 'تركوازي (افتراضي)', primary: '#14b8a6', secondary: '#06b6d4' },
        { name: 'أزرق ملكي', primary: '#3b82f6', secondary: '#60a5fa' },
        { name: 'بنفسجي', primary: '#8b5cf6', secondary: '#a78bfa' },
        { name: 'أخضر زمردي', primary: '#10b981', secondary: '#34d399' },
        { name: 'ذهبي فاخر', primary: '#f59e0b', secondary: '#fbbf24' },
        { name: 'وردي', primary: '#ec4899', secondary: '#f472b6' },
    ];

    const handleSave = () => {
        setSaving(true);
        localStorage.setItem('adora_platform_logo', logoUrl);
        localStorage.setItem('adora_primary_color', primaryColor);
        localStorage.setItem('adora_secondary_color', secondaryColor);

        // Apply theme immediately via CSS variables used by theme-system/adora-components
        const root = document.documentElement.style;
        root.setProperty('--color-primary', primaryColor);
        root.setProperty('--color-secondary', secondaryColor);
        root.setProperty('--theme-primary-500', primaryColor);
        root.setProperty('--theme-primary-400', secondaryColor);
        root.setProperty('--theme-primary-600', primaryColor);
        root.setProperty('--theme-gradient-primary', `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`);

        setTimeout(() => {
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 500);
    };

    return (
        <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
            {/* Header - Clickable */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                        <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">الهوية البصرية</h3>
                        <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                            تخصيص شكل المنصة (اللوجو والألوان) - تظهر في صفحة الدخول وجميع الواجهات
                        </p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-slate-50 dark:bg-slate-800/60 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                <div className="p-4 sm:p-6 space-y-4">
                    <p className="text-xs text-white/60 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                        {t('admin.theseSettingsChangePlatform')}
                    </p>

                    {/* Logo URL */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                            رابط اللوجو (Logo URL)
                        </label>
                        <input
                            id="logo-url"
                            name="logoUrl"
                            type="url"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            placeholder={t('owner.exampleLogoUrl') || 'https://example.com/logo.png'}
                            dir="ltr"
                        />
                        {logoUrl && (
                            <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700/50">
                                <img
                                    src={logoUrl}
                                    alt="معاينة اللوجو"
                                    className="max-h-20 max-w-full object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/adora-logo.png';
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Theme Colors */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-2">
                            ألوان الثيم
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2 sm:mb-3">
                            {presetColors.map((preset) => (
                                <button
                                    key={preset.name}
                                    onClick={() => {
                                        setPrimaryColor(preset.primary);
                                        setSecondaryColor(preset.secondary);
                                    }}
                                    className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${primaryColor === preset.primary
                                            ? 'border-white/30 bg-white/10'
                                            : 'border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div
                                        className="w-6 h-6 rounded-full shadow-lg"
                                        style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
                                    />
                                    <span className="text-white/60 text-xs flex-1 text-right">{preset.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Custom Color Picker */}
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs text-white/50 mb-1">اللون الأساسي</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="primary-color-picker"
                                        name="primaryColorPicker"
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <input
                                        id="primary-color-text"
                                        name="primaryColorText"
                                        type="text"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-white/50 mb-1">اللون الثانوي</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="secondary-color-picker"
                                        name="secondaryColorPicker"
                                        type="color"
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <input
                                        id="secondary-color-text"
                                        name="secondaryColorText"
                                        type="text"
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-3 p-4 rounded-xl border border-white/10" style={{
                            background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}10)`
                        }}>
                            <p className="text-white/60 text-xs mb-2">معاينة الألوان:</p>
                            <div className="flex gap-2">
                                <button
                                    className="px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg transition-transform hover:scale-105"
                                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                                >
                                    زر رئيسي
                                </button>
                                <button
                                    className="px-4 py-2 rounded-lg text-sm font-medium"
                                    style={{
                                        background: `${primaryColor}20`,
                                        color: primaryColor,
                                        border: `1px solid ${primaryColor}40`
                                    }}
                                >
                                    زر ثانوي
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                    >
                        {saving ? (
                            <AdoraLoaderInline size={16} />
                        ) : saved ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                {t('admin.saveSuccess')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {t('admin.saveVisualIdentity')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ✅ Developer Branding Section Component
const DeveloperBrandingSection: React.FC<{ onSettingsUpdate?: (settings: any) => void }> = ({ onSettingsUpdate }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { success, error } = useUX();
    const [isCollapsed, setIsCollapsed] = useState(true); // ✅ Collapsed by default
    const [devPhoneSA, setDevPhoneSA] = useState(localStorage.getItem('adora_dev_phone_sa') || '966570707121');
    const [devPhoneEG, setDevPhoneEG] = useState(localStorage.getItem('adora_dev_phone_eg') || '201500000162');
    const [devEmail, setDevEmail] = useState(localStorage.getItem('adora_dev_email') || '77aayy@gmail.com');
    const [devName, setDevName] = useState(localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda');
    const [devSignature, setDevSignature] = useState(localStorage.getItem('adora_dev_signature') || 'Crafted by Ayman Abo Warda');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const justSavedRef = useRef(false); // ✅ Prevent reload after save

    // ✅ Load from Firebase on mount (with localStorage as fallback)
    // ✅ CRITICAL: Only load on mount, never reload after save
    useEffect(() => {
        // ✅ CRITICAL: Skip reload if we just saved (prevent overwriting user changes)
        if (justSavedRef.current) {
            logger.debug('⏸️ Skipping reload - data was just saved', undefined, 'EnhancedOwnerDashboard');
            justSavedRef.current = false;
            setLoading(false);
            return;
        }

        const loadDeveloperSettings = async () => {
            try {
                // ✅ CRITICAL: Read from localStorage FIRST (it's the source of truth since Firebase write is blocked)
                const localKey = 'adora_system_settings';
                const localData = localStorage.getItem(localKey);
                if (localData) {
                    try {
                        const parsed = JSON.parse(localData);
                        if (parsed.developerBranding) {
                            const { devPhoneSA, devPhoneEG, devEmail, devName, devSignature } = parsed.developerBranding;
                            // ✅ Always update state, even if value is empty (to clear old values)
                            setDevPhoneSA(devPhoneSA || '');
                            setDevPhoneEG(devPhoneEG || '');
                            setDevEmail(devEmail || '');
                            setDevName(devName || '');
                            setDevSignature(devSignature || '');
                            
                            // ✅ CRITICAL: Sync to individual localStorage keys for backward compatibility
                            if (devPhoneSA) localStorage.setItem('adora_dev_phone_sa', devPhoneSA);
                            if (devPhoneEG) localStorage.setItem('adora_dev_phone_eg', devPhoneEG);
                            if (devEmail) localStorage.setItem('adora_dev_email', devEmail);
                            if (devName) localStorage.setItem('adora_dev_name', devName);
                            if (devSignature) localStorage.setItem('adora_dev_signature', devSignature);
                            
                            setLoading(false);
                            return; // ✅ Use localStorage data, don't check Firebase
                        }
                    } catch (e) {
                        logger.warn('Failed to parse localStorage system_settings:', e, 'EnhancedOwnerDashboard');
                    }
                }
                
                // ✅ Fallback: Check individual localStorage keys (for backward compatibility)
                const localName = localStorage.getItem('adora_dev_name');
                const localPhoneSA = localStorage.getItem('adora_dev_phone_sa');
                const localPhoneEG = localStorage.getItem('adora_dev_phone_eg');
                const localEmail = localStorage.getItem('adora_dev_email');
                const localSignature = localStorage.getItem('adora_dev_signature');
                
                if (localName || localPhoneSA || localPhoneEG || localEmail || localSignature) {
                    if (localName) setDevName(localName);
                    if (localPhoneSA) setDevPhoneSA(localPhoneSA);
                    if (localPhoneEG) setDevPhoneEG(localPhoneEG);
                    if (localEmail) setDevEmail(localEmail);
                    if (localSignature) setDevSignature(localSignature);
                    setLoading(false);
                    return; // ✅ Use localStorage data
                }
                
                // ✅ Last resort: Try Firebase (but it will likely fail due to Rules)
                const settings = await getSystemSettings(false); // Don't force refresh
                if (settings?.developerBranding) {
                    const branding = settings.developerBranding;
                    setDevPhoneSA(branding.devPhoneSA || '');
                    setDevPhoneEG(branding.devPhoneEG || '');
                    setDevEmail(branding.devEmail || '');
                    setDevName(branding.devName || '');
                    setDevSignature(branding.devSignature || '');
                }
            } catch (err) {
                logger.warn('Failed to load developer settings:', err, 'EnhancedOwnerDashboard');
            } finally {
                setLoading(false);
            }
        };
        
        loadDeveloperSettings();
    }, []); // ✅ Empty dependency array - only runs on mount, NEVER reloads after save

    const handleSave = async () => {
        setSaving(true);
        try {
            // ✅ 1. Save to localStorage first (source of truth for this session)
            localStorage.setItem('adora_dev_phone_sa', devPhoneSA);
            localStorage.setItem('adora_dev_phone_eg', devPhoneEG);
            localStorage.setItem('adora_dev_email', devEmail);
            localStorage.setItem('adora_dev_name', devName);
            localStorage.setItem('adora_dev_signature', devSignature);

            // ✅ 2. Update adora_system_settings in localStorage for consistency
            try {
                const localKey = 'adora_system_settings';
                const existing = localStorage.getItem(localKey);
                const currentLocal = existing ? JSON.parse(existing) : {};
                const updated = {
                    ...currentLocal,
                    developerBranding: {
                        devPhoneSA,
                        devPhoneEG,
                        devEmail,
                        devName,
                        devSignature
                    },
                    updatedAt: new Date().toISOString(),
                    updatedBy: user?.id || 'system'
                };
                localStorage.setItem(localKey, JSON.stringify(updated));
            } catch (err) {
                logger.warn('Could not update localStorage system_settings:', err, 'EnhancedOwnerDashboard');
            }

            justSavedRef.current = true;

            // ✅ 3. Dispatch event IMMEDIATELY so DeveloperFooter (and LoginScreen, DeveloperSignature) update even if Firebase fails
            const configData = {
                devName,
                phoneSA: devPhoneSA,
                phoneEG: devPhoneEG,
                email: devEmail,
                signature: devSignature
            };
            window.dispatchEvent(new CustomEvent('adora_dev_settings_updated', { detail: configData }));

            setSaved(true);
            success(t('admin.saveSuccess') || 'تم حفظ الإعدادات بنجاح');

            // ✅ 4. Persist to Firebase (cross-device); footer already updated from step 3
            try {
                await updateSystemSettings({
                    developerBranding: {
                        devPhoneSA,
                        devPhoneEG,
                        devEmail,
                        devName,
                        devSignature
                    }
                }, user?.id || 'system');

                if (onSettingsUpdate) {
                    const currentSettings = await getSystemSettings(true);
                    if (currentSettings) {
                        onSettingsUpdate({
                            developerBranding: {
                                devPhoneSA,
                                devPhoneEG,
                                devEmail,
                                devName,
                                devSignature
                            }
                        });
                    }
                }

                try {
                    const { invalidateCache } = await import('../../utils/requestCache');
                    invalidateCache('settings:system');
                } catch (err) {
                    logger.warn('Could not invalidate cache:', err, 'EnhancedOwnerDashboard');
                }
            } catch (firebaseErr: unknown) {
                logger.error('Error saving developer settings to Firebase:', firebaseErr, 'EnhancedOwnerDashboard');
                error(t('admin.errorSavingSettings') || 'خطأ في حفظ الإعدادات');
                // Footer and localStorage already updated; only Firebase sync failed
            }

            setTimeout(() => {
                justSavedRef.current = false;
                setSaved(false);
            }, 5000);
        } catch (err: unknown) {
            logger.error('Error saving developer settings:', err, 'EnhancedOwnerDashboard');
            error(t('admin.errorSavingSettings') || 'خطأ في حفظ الإعدادات');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
            {/* Header - Clickable */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 flex-shrink-0">
                        <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">{t('admin.developerSettings')}</h3>
                        <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                            {t('admin.technicalSupportAndCopyright')}
                        </p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-800/60 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                <div className="p-4 sm:p-6 space-y-4">
                    <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed bg-white dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                        💡 هذه البيانات تُستخدم في رابط "نسيت الكود" وتوقيع حقوق الملكية في أسفل الصفحات.
                        يمكنك تغييرها في أي وقت.
                    </p>

                    {/* Developer Phone - Saudi */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-white/70 mb-1.5">
                            📱 رقم واتساب السعودية (+966)
                        </label>
                        <input
                            id="dev-phone-sa"
                            name="devPhoneSA"
                            type="tel"
                            value={devPhoneSA}
                            onChange={(e) => setDevPhoneSA(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            placeholder={t('owner.examplePhoneSA') || '966570707121'}
                            dir="ltr"
                        />
                        <p className="text-xs text-slate-500 dark:text-white/40 mt-1">{t('owner.enterPhoneWithCountryCode') || 'ادخل الرقم بالمفتاح الدولي بدون + (مثال: 966570707121)'}</p>
                    </div>

                    {/* Developer Phone - Egypt */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-white/70 mb-1.5">
                            📱 رقم واتساب مصر (+20)
                        </label>
                        <input
                            id="dev-phone-eg"
                            name="devPhoneEG"
                            type="tel"
                            value={devPhoneEG}
                            onChange={(e) => setDevPhoneEG(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            placeholder={t('owner.examplePhoneEG') || '201500000162'}
                            dir="ltr"
                        />
                        <p className="text-xs text-slate-500 dark:text-white/40 mt-1">ادخل الرقم بالمفتاح الدولي بدون + (مثال: 201500000162)</p>
                    </div>

                    {/* Developer Email */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-white/70 mb-1.5">
                            البريد الإلكتروني للمطور
                        </label>
                        <input
                            id="dev-email"
                            name="devEmail"
                            type="email"
                            value={devEmail}
                            onChange={(e) => setDevEmail(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            placeholder={t('owner.exampleEmail') || '77aayy@gmail.com'}
                            dir="ltr"
                        />
                        <p className="text-xs text-slate-500 dark:text-white/40 mt-1">{t('owner.appearsInDeveloperSignature') || 'يظهر في توقيع المطور أسفل الصفحات'}</p>
                    </div>

                    {/* Developer Name */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-white/70 mb-1.5">
                            اسم المطور / الشركة
                        </label>
                        <input
                            id="dev-name"
                            name="devName"
                            type="text"
                            value={devName}
                            onChange={(e) => setDevName(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            placeholder={t('owner.exampleDeveloperName') || 'Ayman Abu Warda'}
                        />
                    </div>

                    {/* Developer Signature */}
                    <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-white/70 mb-1.5">
                            توقيع المطور (Copyright)
                        </label>
                        <input
                            id="dev-signature"
                            name="devSignature"
                            type="text"
                            value={devSignature}
                            onChange={(e) => setDevSignature(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white dark:bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-lg sm:rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-colors text-sm sm:text-base"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            placeholder={t('owner.exampleCraftedBy') || 'Crafted by Ayman Abu Warda'}
                        />
                        <p className="text-xs text-slate-500 dark:text-white/40 mt-1">يظهر في أسفل صفحات النظام</p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <AdoraLoaderInline size={16} />
                        ) : saved ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                {t('admin.saveSuccess')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {t('admin.saveDeveloperSettings')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UpdatesTab: React.FC<{
    updates: SystemSettings['updates'];
    onAddUpdate: () => void;
}> = ({ updates, onAddUpdate }) => {
    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastSent, setBroadcastSent] = useState(false);

    // ✅ Global Update Broadcast - Send notification to ALL users
    const handleBroadcastUpdate = async () => {
        if (updates.length === 0) {
            await customConfirm({
                title: t('common.warning'),
                message: t('admin.noUpdatesToBroadcast'),
                confirmText: t('common.ok'),
                showCancel: false,
                type: 'warning'
            });
            return;
        }

        const latestUpdate = updates[0];
        const confirmBroadcast = await customConfirm({
            title: t('admin.broadcastUpdate'),
            message: t('admin.sendNotificationToAllUsers', { version: latestUpdate.version }),
            confirmText: t('admin.broadcastNow'),
            cancelText: t('common.cancel'),
            type: 'info'
        });

        if (!confirmBroadcast) return;

        setBroadcasting(true);
        try {
            // Store broadcast notification in system_configs for all users to pick up
            const { doc: docRef, setDoc, serverTimestamp } = await import('firebase/firestore');
            if (db) {
                await setDoc(docRef(db, 'system_configs', 'latest_update_broadcast'), {
                    version: latestUpdate.version,
                    changelog: latestUpdate.changelog,
                    critical: latestUpdate.critical,
                    broadcastAt: serverTimestamp(),
                    message: t('admin.newUpdateAvailable', { version: latestUpdate.version, changelog: latestUpdate.changelog })
                });
            }

            setBroadcastSent(true);
            setTimeout(() => setBroadcastSent(false), 5000);
        } catch (error) {
            logger.error('Error broadcasting update:', error, 'EnhancedOwnerDashboard');
            await customConfirm({
                title: t('admin.error'),
                message: t('admin.errorBroadcastingUpdate'),
                confirmText: t('common.ok'),
                showCancel: false,
                type: 'danger'
            });
        } finally {
            setBroadcasting(false);
        }
    };

    return (
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('admin.updates')}</h3>
                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                        {t('admin.manageSystemUpdates')}
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={onAddUpdate}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">{t('admin.addUpdate')}</span>
                    </button>
                    {/* ✅ Global Broadcast Button */}
                    <button
                        onClick={handleBroadcastUpdate}
                        disabled={broadcasting || updates.length === 0}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${broadcastSent
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                            }`}
                    >
                        {broadcasting ? (
                            <AdoraLoaderInline size={16} />
                        ) : broadcastSent ? (
                            <>
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden sm:inline">{t('admin.broadcastSent')}</span>
                            </>
                        ) : (
                            <>
                                <Bell className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden sm:inline">{t('admin.broadcastUpdateButton')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ✅ Broadcast Info Banner */}
            <div className="mb-4 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <p className="text-purple-300 text-xs flex items-center gap-2">
                    <Bell className="w-4 h-4 flex-shrink-0" />
                    <span>
                        {t('admin.broadcastUpdateButtonDesc')}
                    </span>
                </p>
            </div>
            <div className="space-y-3">
                {updates.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 px-4">
                        <Activity className="w-12 h-12 sm:w-16 sm:h-16 text-white/10 mx-auto mb-4" />
                        <p className="text-white/60 font-medium mb-2 text-sm sm:text-base">{t('admin.noUpdatesRecorded')}</p>
                        <p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                            {t('admin.addUpdateLogs')}
                            {t('admin.criticalUpdatesProminent')}
                        </p>
                    </div>
                ) : (
                    updates.map(update => (
                        <div key={update.version} className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-white text-sm sm:text-base">الإصدار {update.version}</h4>
                                        {update.critical && (
                                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] sm:text-xs whitespace-nowrap">
                                                حرج
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{update.changelog}</p>
                                    <p className="text-[10px] sm:text-xs text-white/40 mt-1.5 sm:mt-1">
                                        {formatDateGregorianEn(new Date(update.releaseDate))}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const BroadcastsTab: React.FC<{
    broadcasts: SystemSettings['broadcastMessages'];
    onAddBroadcast: () => void;
}> = ({ broadcasts, onAddBroadcast }) => {
    const { t } = useTranslation();
    return (
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('admin.generalMessages')}</h3>
                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                        {t('admin.sendGeneralMessages')}
                    </p>
                </div>
                <button
                    onClick={onAddBroadcast}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="sm:hidden">{t('admin.addMessage')}</span>
                </button>
            </div>
            <div className="space-y-3">
                {broadcasts.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 px-4">
                        <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-white/10 mx-auto mb-4" />
                        <p className="text-white/60 font-medium mb-2 text-sm sm:text-base">{t('admin.noGeneralMessages')}</p>
                        <p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                            {t('admin.addGeneralMessages')}
                            {t('admin.messagesWillAppear')}
                        </p>
                    </div>
                ) : (
                    broadcasts.map(broadcast => (
                        <div
                            key={broadcast.id}
                            className={`bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border-l-4 ${broadcast.type === 'error' ? 'border-red-500' :
                                    broadcast.type === 'warning' ? 'border-yellow-500' :
                                        broadcast.type === 'success' ? 'border-green-500' :
                                            'border-blue-500'
                                }`}
                        >
                            <h4 className="font-bold text-white text-sm sm:text-base">{broadcast.title}</h4>
                            <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">{broadcast.message}</p>
                            <p className="text-[10px] sm:text-xs text-white/40 mt-2">
                                {formatDateGregorianEn(new Date(broadcast.startDate))} - {formatDateGregorianEn(new Date(broadcast.endDate))}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

const StatusItem: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    color: 'blue' | 'green' | 'yellow' | 'red';
}> = ({ label, value, icon: Icon, color }) => {
    const colorClasses = {
        blue: 'text-blue-500',
        green: 'text-primary-500',
        yellow: 'text-amber-500',
        red: 'text-red-500'
    };

    return (
        <div className="flex items-center gap-2 sm:gap-3">
            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colorClasses[color]} flex-shrink-0`} />
            <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{label}</p>
                <p className={`text-base sm:text-lg font-bold ${colorClasses[color]}`}>{value}</p>
            </div>
        </div>
    );
};

// ============================================================
// FIREBASE AUTO-SETUP HELPERS
// ============================================================

/**
 * Get default Firestore Rules for new tenant
 */
function getDefaultFirestoreRules(): string {
    return `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ✅ Allow authenticated users to read/write their own data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // ✅ Public read-only access for certain collections (adjust as needed)
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
    `.trim();
}

/**
 * Get default Firestore Indexes for new tenant
 */
function getDefaultFirestoreIndexes(): string {
    return `
{
  "indexes": [],
  "fieldOverrides": []
}
    `.trim();
}

// ============================================================
// MODALS
// ============================================================

const UpdateModal: React.FC<{
    onClose: () => void;
    onSave: (update: SystemSettings['updates'][0]) => void;
}> = ({ onClose, onSave }) => {
    const [version, setVersion] = useState('');
    const [changelog, setChangelog] = useState('');
    const [critical, setCritical] = useState(false);
    const [required, setRequired] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            version,
            releaseDate: new Date(),
            changelog,
            critical,
            requiredUpdate: required
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass rounded-2xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-6">{t('admin.addNewUpdate')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        id="version-input"
                        name="version"
                        type="text"
                        placeholder={t('admin.versionPlaceholder') || 'رقم الإصدار (مثال: 3.1.0)'}
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-500/30"
                    />
                    <textarea
                        id="changelog-textarea"
                        name="changelog"
                        placeholder={t('admin.changelogPlaceholder') || 'سجل التغييرات'}
                        value={changelog}
                        onChange={(e) => setChangelog(e.target.value)}
                        required
                        rows={4}
                        className="w-full px-4 py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 resize-none"
                        style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                    />
                    <label className="flex items-center gap-3 text-white/60">
                        <input
                            id="critical-checkbox"
                            name="critical"
                            type="checkbox"
                            checked={critical}
                            onChange={(e) => setCritical(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <span>{t('admin.criticalUpdate')}</span>
                    </label>
                    <label className="flex items-center gap-3 text-white/60">
                        <input
                            id="required-checkbox"
                            name="required"
                            type="checkbox"
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <span>{t('admin.forceUpdate')}</span>
                    </label>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl text-white hover:from-yellow-600 hover:to-yellow-700 transition-all font-medium"
                        >
                            {t('admin.addUpdate')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ✅ Tenant Multi-Select Dropdown Component
const TenantMultiSelect: React.FC<{
    tenants: Array<{ id: string; name: string }>;
    selectedTenants: string[];
    onToggle: (tenantId: string) => void;
    loading: boolean;
}> = ({ tenants, selectedTenants, onToggle, loading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedNames = tenants
        .filter(t => selectedTenants.includes(t.id))
        .map(t => t.name);

    return (
        <div className="space-y-3">
            <div className="relative" ref={containerRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-4 py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-xl text-white/80 hover:bg-white/10 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-all flex items-center justify-between"
                    style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                >
                    <span className="text-sm">
                        {loading ? t('admin.loading') :
                            selectedTenants.length === 0 ? t('common.select') :
                                selectedTenants.length === 1 ? selectedNames[0] :
                                    t('admin.selectedTenantsPlural', { count: selectedTenants.length })}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-2xl max-h-[250px] overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-4 text-white/60">{t('admin.loading')}</div>
                        ) : tenants.length === 0 ? (
                            <div className="text-center py-4 text-white/60">لا يوجد مستأجرون</div>
                        ) : (
                            <div className="space-y-1">
                                {tenants.map(tenant => (
                                    <label
                                        key={tenant.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                                    >
                                        <input
                                            id={`tenant-checkbox-${tenant.id}`}
                                            name={`tenant-${tenant.id}`}
                                            type="checkbox"
                                            checked={selectedTenants.includes(tenant.id)}
                                            onChange={() => onToggle(tenant.id)}
                                            className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span className="text-sm text-white/80 flex-1">{tenant.name}</span>
                                        {selectedTenants.includes(tenant.id) && (
                                            <Check className="w-4 h-4 text-blue-400" />
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedTenants.length > 0 && (
                <div className="text-xs text-white/60 bg-blue-500/10 p-2 rounded-lg">
                    {t('admin.selectedTenantsPlural', { count: selectedTenants.length })}: {selectedNames.join('، ')}
                </div>
            )}
        </div>
    );
};

const BroadcastModal: React.FC<{
    onClose: () => void;
    onSave: (message: SystemSettings['broadcastMessages'][0]) => void;
}> = ({ onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all');
    const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
    const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
    const [loadingTenants, setLoadingTenants] = useState(false);

    // Scheduled message options
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduleType, setScheduleType] = useState<'license_expiry'>('license_expiry');
    const [daysBeforeExpiry, setDaysBeforeExpiry] = useState<number>(7);
    const [targetRoles, setTargetRoles] = useState<('manager' | 'employee' | 'staff')[]>(['manager', 'employee', 'staff']);

    // Load tenants when modal opens
    useEffect(() => {
        const loadTenants = async () => {
            setLoadingTenants(true);
            try {
                const managers = await getAllManagers();
                const tenantList = managers
                    .filter(m => m.tenantId)
                    .map(m => ({
                        id: m.tenantId!,
                        name: m.name || `مدير ${m.code || m.id}`
                    }));
                setTenants(tenantList);
            } catch (error) {
                logger.error('Error loading tenants:', error, 'EnhancedOwnerDashboard');
            } finally {
                setLoadingTenants(false);
            }
        };
        loadTenants();
    }, []);

    const handleTenantToggle = (tenantId: string) => {
        setSelectedTenants(prev =>
            prev.includes(tenantId)
                ? prev.filter(id => id !== tenantId)
                : [...prev, tenantId]
        );
    };

    const handleRoleToggle = (role: 'manager' | 'employee' | 'staff') => {
        setTargetRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // ✅ Validate dates before submission
        if (!startDate || !endDate) {
            alert(t('admin.selectStartAndEndDate') || 'يرجى تحديد تاريخ البدء وتاريخ الانتهاء');
            return;
        }

        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);

        // ✅ Check if dates are valid
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            alert(t('admin.invalidDate') || 'تاريخ غير صالح. يرجى التحقق من تنسيق التاريخ');
            return;
        }

        // ✅ Ensure end date is after start date
        if (parsedEndDate <= parsedStartDate) {
            alert(t('admin.endDateAfterStart') || 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء');
            return;
        }

        onSave({
            id: `broadcast-${Date.now()}`,
            title,
            message,
            type,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            targetTenants: targetMode === 'all' ? [] : selectedTenants, // Empty = broadcast to all
            isScheduled: isScheduled,
            scheduleType: isScheduled ? scheduleType : undefined,
            daysBeforeExpiry: isScheduled ? daysBeforeExpiry : undefined,
            targetRoles: isScheduled ? targetRoles : undefined
        });
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6">{t('admin.addGeneralMessage')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        id="broadcast-title"
                        name="broadcastTitle"
                        type="text"
                        placeholder={t('owner.title')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-500/30"
                    />
                    <textarea
                        id="broadcast-message"
                        name="broadcastMessage"
                        placeholder={t('owner.message')}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        rows={4}
                        className="w-full px-4 py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 resize-none"
                        style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                    />
                    <select
                        id="broadcast-type"
                        name="broadcastType"
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full px-4 py-3 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-xl text-white text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-primary-500/50 [&>option]:bg-[#0f172a] [&>option]:text-white"
                        style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                    >
                        <option value="info">معلومات</option>
                        <option value="warning">تحذير</option>
                        <option value="success">نجاح</option>
                        <option value="error">خطأ</option>
                    </select>
                    <input
                        id="broadcast-start-date"
                        name="broadcastStartDate"
                        type="datetime-local"
                        placeholder={t('common.startDate') || 'تاريخ البدء'}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-500/30"
                    />
                    <input
                        id="broadcast-end-date"
                        name="broadcastEndDate"
                        type="datetime-local"
                        placeholder={t('common.endDate') || 'تاريخ الانتهاء'}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:focus:ring-primary-500/30"
                    />

                    {/* Scheduled Message Option */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                id="broadcast-is-scheduled"
                                name="broadcastIsScheduled"
                                type="checkbox"
                                checked={isScheduled}
                                onChange={(e) => setIsScheduled(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-sm text-white/80">رسالة مجدولة (تظهر قبل انتهاء الترخيص)</span>
                        </label>

                        {isScheduled && (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                                <div>
                                    <label className="text-sm text-white/80 mb-2 block">عدد الأيام قبل انتهاء الترخيص</label>
                                    <input
                                        id="days-before-expiry"
                                        name="daysBeforeExpiry"
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={daysBeforeExpiry}
                                        onChange={(e) => setDaysBeforeExpiry(parseInt(e.target.value) || 7)}
                                        className="w-full px-4 py-2 bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 rounded-xl text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40"
                                        style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-white/80 mb-2 block">الأدوار المستهدفة</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(['manager', 'employee', 'staff'] as const).map(role => (
                                            <label key={role} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    id={`role-checkbox-${role}`}
                                                    name={`targetRole-${role}`}
                                                    type="checkbox"
                                                    checked={targetRoles.includes(role)}
                                                    onChange={() => handleRoleToggle(role)}
                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500"
                                                />
                                                <span className="text-xs text-white/80">
                                                    {role === 'manager' ? t('owner.subscribers') : t('owner.employees')}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-xs text-white/60 bg-blue-500/10 p-2 rounded-lg">
                                    💡 هذه الرسالة ستظهر تلقائياً قبل انتهاء الترخيص بعدد الأيام المحدد لجميع المستأجرين المحددين
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Target Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-white/80">الوجهة</label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setTargetMode('all')}
                                className={`flex-1 px-4 py-2 rounded-xl transition-all ${targetMode === 'all'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                جميع المستأجرين
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetMode('specific')}
                                className={`flex-1 px-4 py-2 rounded-xl transition-all ${targetMode === 'specific'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                مستأجرين محددين
                            </button>
                        </div>

                        {targetMode === 'specific' && (
                            <TenantMultiSelect
                                tenants={tenants}
                                selectedTenants={selectedTenants}
                                onToggle={handleTenantToggle}
                                loading={loadingTenants}
                            />
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white hover:from-blue-600 hover:to-blue-700 transition-all font-medium"
                        >
                            {t('admin.addUpdate')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ✅ Add Manager Modal - Multi-Step Wizard
const AddManagerModal: React.FC<{
    systemSettings: SystemSettings | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ systemSettings, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const defaultFirebaseConfig: FirebaseConfig = {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: ''
    };

    // ✅ Restore from draft (after refresh)
    const draft = getAddManagerDraft();
    const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 1);
    const TOTAL_STEPS = 4;

    const [name, setName] = useState(draft?.name ?? '');
    const [phone, setPhone] = useState(draft?.phone ?? '');
    const [phoneBackup, setPhoneBackup] = useState(draft?.phoneBackup ?? '');
    const [code, setCode] = useState(draft?.code ?? '');
    const [hotelName, setHotelName] = useState(draft?.hotelName ?? '');

    const [branchCodes, setBranchCodes] = useState<Array<{ code: string; name: string }>>(draft?.branchCodes ?? []);
    const [currentBranchCode, setCurrentBranchCode] = useState('');
    const [currentBranchName, setCurrentBranchName] = useState('');

    const [subscriptionDuration, setSubscriptionDuration] = useState<1 | 2>(draft?.subscriptionDuration ?? 1);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'bank_transfer' | 'deferred'>(
        (draft?.paymentMethod as 'cash' | 'credit' | 'bank_transfer' | 'deferred') ?? 'cash'
    );

    const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>(draft?.firebaseConfig ? { ...defaultFirebaseConfig, ...draft.firebaseConfig } : defaultFirebaseConfig);
    const [firebaseTestPassed, setFirebaseTestPassed] = useState(false);
    const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user, authReady } = useAuth();
    const { success: showSuccess, error: showError } = useUX();
    const [conflictingCodes, setConflictingCodes] = useState<Set<string>>(new Set());
    const [checkingCodes, setCheckingCodes] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);

    // ✅ Persist draft to sessionStorage when form/step changes (so refresh restores)
    useEffect(() => {
        if (loading) return;
        setAddManagerDraft({
            currentStep,
            name,
            phone,
            phoneBackup,
            code,
            hotelName,
            branchCodes,
            subscriptionDuration,
            paymentMethod,
            firebaseConfig: {
                apiKey: firebaseConfig.apiKey ?? '',
                authDomain: firebaseConfig.authDomain ?? '',
                projectId: firebaseConfig.projectId ?? '',
                storageBucket: firebaseConfig.storageBucket ?? '',
                messagingSenderId: firebaseConfig.messagingSenderId ?? '',
                appId: firebaseConfig.appId ?? ''
            }
        });
    }, [loading, currentStep, name, phone, phoneBackup, code, hotelName, branchCodes, subscriptionDuration, paymentMethod, firebaseConfig]);

    // ✅ Wizard Navigation
    const canGoNext = () => {
        switch (currentStep) {
            case 1: // Basic Info - اسم المشترك إجباري
                return name.trim().length >= 2 && phone.length >= 9 && code.length === 4 && /^\d+$/.test(code) && !conflictingCodes.has(code);
            case 2: // Branches
                return branchCodes.length > 0;
            case 3: // Subscription & Firebase (إجباري)
                // ✅ Firebase Config is now REQUIRED
                return firebaseConfig.apiKey.trim().length > 0 && 
                       firebaseConfig.projectId.trim().length > 0 && 
                       firebaseConfig.authDomain.trim().length > 0 &&
                       firebaseConfig.storageBucket.trim().length > 0;
            case 4: // Review
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (currentStep < TOTAL_STEPS && canGoNext()) {
            setError('');
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setError('');
            setCurrentStep(prev => prev - 1);
        }
    };

    // Step Titles
    const stepTitles = {
        1: t('admin.basicData'),
        2: t('sidebar.branches'),
        3: t('admin.subscriptionAndPayment'),
        4: t('admin.reviewAndSave')
    };

    const handleCodeChange = async (newCode: string) => {
        setCode(newCode);
        setError('');
        if (newCode.length === 4) {
            setCheckingCodes(true);
            try {
                const available = await isPinAvailable(newCode, { authReady, user: user as any });
                if (!available) {
                    setConflictingCodes(prev => new Set(prev).add(newCode));
                    setError(`تحذير: الكود ${newCode} مستخدم بالفعل في النظام.`);
                } else {
                    setConflictingCodes(prev => {
                        const next = new Set(prev);
                        next.delete(newCode);
                        return next;
                    });
                }
            } catch (err) {
                logger.warn('Silent PIN check failed:', err, 'EnhancedOwnerDashboard');
            } finally {
                setCheckingCodes(false);
            }
        }
    };

    // ✅ Generate unique manager code (4 digits)
    const handleGenerateCode = async () => {
        setGeneratingCode(true);
        setError('');
        try {
            const newCode = await suggestUniquePin();
            await handleCodeChange(newCode);
        } catch (err: any) {
            setError(err.message || 'فشل توليد الكود. حاول مرة أخرى.');
        } finally {
            setGeneratingCode(false);
        }
    };

    const handleAddBranch = async () => {
        logger.debug('🔵 handleAddBranch called', { currentBranchCode, currentBranchName, authReady, user: user?.email }, 'EnhancedOwnerDashboard');

        if (!currentBranchCode.trim() || !currentBranchName.trim()) {
            logger.warn('🔴 Empty branch code or name', undefined, 'EnhancedOwnerDashboard');
            return;
        }
        const bCode = currentBranchCode.trim();

        // ✅ التحقق من كود الفرع:
        // 1. أرقام فقط (بدون حروف)
        // 2. من 1 إلى 4 أرقام
        // 3. لا يبدأ بـ 0
        if (!/^[1-9]\d{0,3}$/.test(bCode)) {
            logger.warn('🔴 Invalid branch code format:', bCode, 'EnhancedOwnerDashboard');
            setError('كود الفرع يجب أن يكون من 1 إلى 4 أرقام، بدون حروف، ولا يبدأ بصفر');
            return;
        }
        if (branchCodes.some(b => b.code === bCode)) {
            logger.warn('🔴 Branch code already exists in list', undefined, 'EnhancedOwnerDashboard');
            setError('كود الفرع موجود بالفعل في قائمتك');
            return;
        }
        if (bCode === code) {
            logger.warn('🔴 Branch code same as manager code', undefined, 'EnhancedOwnerDashboard');
            setError('كود الفرع يجب أن يختلف عن كود المدير الرئيسي');
            return;
        }

        logger.debug('🟢 Validation passed, checking PIN availability...', undefined, 'EnhancedOwnerDashboard');
        setLoading(true);
        setCheckingCodes(true);
        try {
            const available = await isPinAvailable(bCode, { authReady, user: user as any });
            logger.debug('🟢 PIN availability result:', available, 'EnhancedOwnerDashboard');
            if (!available) {
                setError(`تحذير: كود الفرع ${bCode} مستخدم بالفعل في مؤسسة أخرى.`);
                setConflictingCodes(prev => new Set(prev).add(bCode));
                setLoading(false);
                setCheckingCodes(false);
                return;
            }
            logger.info('✅ Adding branch to list...', undefined, 'EnhancedOwnerDashboard');
            setBranchCodes([...branchCodes, { code: bCode, name: currentBranchName.trim() }]);
            setCurrentBranchCode('');
            setCurrentBranchName('');
            setError('');
            setConflictingCodes(prev => {
                const next = new Set(prev);
                next.delete(bCode);
                return next;
            });
            logger.info('✅ Branch added successfully!', undefined, 'EnhancedOwnerDashboard');
        } catch (err: any) {
            logger.error('🔴 Branch PIN check error:', err, 'EnhancedOwnerDashboard');
            setError('حدث خطأ أثناء التحقق من كود الفرع. حاول مرة أخرى.');
        } finally {
            setLoading(false);
            setCheckingCodes(false);
        }
    };

    const handleRemoveBranch = (codeToRemove: string) => {
        setBranchCodes(branchCodes.filter(c => c.code !== codeToRemove));
        setConflictingCodes(prev => {
            const next = new Set(prev);
            next.delete(codeToRemove);
            return next;
        });
    };

    const handleSubmit = async () => {
        // ✅ التحقق من رقم الهاتف (إجباري)
        if (!phone || phone.length < 9) {
            setError('رقم هاتف المدير مطلوب (9 أرقام على الأقل)');
            return;
        }
        if (code.length !== 4 || !/^\d+$/.test(code)) {
            setError(t('admin.managerCodeMustBe4Digits'));
            return;
        }
        if (branchCodes.length === 0) {
            setError(t('admin.mustAddOneBranch'));
            return;
        }
        if (conflictingCodes.has(code)) {
            setError('كود المدير مستخدم بالفعل. يرجى اختيار كود آخر.');
            return;
        }
        if (!authReady || !user) {
            setError('النظام غير جاهز (Auth Not Ready)');
            return;
        }
        setLoading(true);
        try {
            const masterAvailable = await isPinAvailable(code, { authReady, user: user as any });
            if (!masterAvailable) {
                setError('كود المدير مستخدم بالفعل');
                setLoading(false);
                return;
            }
            for (const b of branchCodes) {
                const bAvailable = await isPinAvailable(b.code, { authReady, user: user as any });
                if (!bAvailable) {
                    setError(`كود الفرع ${b.code} (${b.name}) أصبح مستخدماً الآن من شخص آخر.`);
                    setLoading(false);
                    return;
                }
            }
            const branchNamesMap: Record<string, string> = {};
            branchCodes.forEach(b => {
                branchNamesMap[b.code] = b.name;
            });

            // ✅ Firebase Config is now REQUIRED
            if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.authDomain || !firebaseConfig.storageBucket) {
                setError('يجب إدخال جميع بيانات Firebase المطلوبة (apiKey, projectId, authDomain, storageBucket)');
                setLoading(false);
                return;
            }

            // ✅ Build clean firebaseConfig object without undefined values
            const cleanFirebaseConfig: Record<string, string> = {
                apiKey: firebaseConfig.apiKey.trim(),
                authDomain: firebaseConfig.authDomain.trim(),
                projectId: firebaseConfig.projectId.trim(),
                storageBucket: firebaseConfig.storageBucket.trim(),
            };
            // Only add optional fields if they have actual values
            if (firebaseConfig.messagingSenderId?.trim()) {
                cleanFirebaseConfig.messagingSenderId = firebaseConfig.messagingSenderId.trim();
            }
            if (firebaseConfig.appId?.trim()) {
                cleanFirebaseConfig.appId = firebaseConfig.appId.trim();
            }
            
            // ✅ Get Service Account JSON if provided (for auto-setup)
            const serviceAccountJson = (firebaseConfig as any).serviceAccountJson;

            // ✅ NEW: Use Cloud Function for manager creation (100% reliable, no Rules issues)
            let managerResult: { managerId?: string; tenantId?: string; warnings?: string[] } | null = null;
            
            try {
                const { functions, httpsCallable } = await import('../../services/firebase');
                if (functions) {
                    const createManagerFunction = httpsCallable(functions, 'createManager');
                    const result = await createManagerFunction({
                        name: name.trim() || 'مدير جديد',
                        phone: phone.trim(),
                        phoneBackup: phoneBackup.trim() || undefined,
                        code,
                        hotelName: hotelName.trim() || undefined,
                        maxBranches: branchCodes.length,
                        branchCodes: branchCodes.map(b => b.code),
                        branchNames: branchNamesMap,
                        subscriptionDuration: subscriptionDuration,
                        paymentMethod: paymentMethod,
                        firebaseConfig: cleanFirebaseConfig,
                    });
                    
                    const response = result.data as any;
                    if (response.success) {
                        managerResult = {
                            managerId: response.managerId,
                            tenantId: response.tenantId
                        };
                        // ✅ SUCCESS - Everything is automatic!
                        showSuccess(response.message || `✅ تم إنشاء المدير "${name}" بنجاح!\n\n📋 الكود: ${code}\n✅ جاهز للاستخدام تلقائياً!`);
                    } else {
                        throw new Error(response.error || 'فشل إنشاء المدير');
                    }
                } else {
                    throw new Error('Cloud Functions غير متاحة - استخدام طريقة بديلة');
                }
            } catch (functionError: any) {
                // ✅ Fallback: Use client-side createManager (if Functions not available)
                logger.warn('Cloud Function failed, using fallback:', functionError, 'EnhancedOwnerDashboard');
                showError(`⚠️ Cloud Function غير متاحة - استخدام طريقة بديلة...`);
                
                const fallbackResult = await createManager({
                    name: name.trim() || 'مدير جديد',
                    phone: phone.trim(),
                    phoneBackup: phoneBackup.trim() || undefined,
                    code,
                    hotelName: hotelName.trim() || undefined,
                    maxBranches: branchCodes.length,
                    branchCodes: branchCodes.map(b => b.code),
                    branchNames: branchNamesMap,
                    subscriptionDuration: subscriptionDuration,
                    paymentMethod: paymentMethod,
                    firebaseConfig: cleanFirebaseConfig,
                });
                
                managerResult = fallbackResult;
                
                // Show warnings only for fallback method
                if (fallbackResult.warnings && fallbackResult.warnings.length > 0) {
                    fallbackResult.warnings.forEach((warning) => {
                        showError(warning);
                    });
                } else {
                    showSuccess(`✅ تم إنشاء المدير "${name}" بنجاح!\n📋 الكود: ${code}`);
                }
            }

            // ✅ Auto-setup Firebase (Authentication, Firestore Rules, Storage, Anonymous Auth) if Service Account provided
            if (serviceAccountJson && managerResult?.tenantId) {
                try {
                    // Import Firebase Functions
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const functions = getFunctions();
                    const deployTenantFirebase = httpsCallable(functions, 'deployTenantFirebase');
                    
                    // Call deployment function with timeout
                    const deployPromise = deployTenantFirebase({
                        tenantId: managerResult?.tenantId || '',
                        serviceAccountJson: serviceAccountJson,
                        firestoreRules: getDefaultFirestoreRules(),
                        firestoreIndexes: getDefaultFirestoreIndexes(),
                    });
                    
                    // Add timeout (60 seconds)
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('انتهت مهلة الإعداد التلقائي (60 ثانية)')), 60000)
                    );
                    
                    const deployResult = await Promise.race([deployPromise, timeoutPromise]) as any;
                    const result = deployResult.data as any;
                    
                    if (result && result.success) {
                        showSuccess('✅ تم إعداد Firebase تلقائياً بنجاح! (Authentication, Firestore Rules, Storage)');
                    } else {
                        const errorMsg = result?.message || 'خطأ غير معروف';
                        logger.warn('Firebase auto-setup partial failure:', errorMsg, 'EnhancedOwnerDashboard');
                        showError(`⚠️ تم إنشاء المدير بنجاح، لكن فشل الإعداد التلقائي: ${errorMsg}. يمكنك إعداد Firebase يدوياً من Firebase Console.`);
                    }
                } catch (setupError: any) {
                    logger.error('Firebase auto-setup error:', setupError, 'EnhancedOwnerDashboard');
                    const errorMessage = setupError.message || setupError.code || 'خطأ غير معروف';
                    // Don't fail manager creation - it's already created successfully
                    showError(`⚠️ تم إنشاء المدير بنجاح، لكن فشل الإعداد التلقائي لـ Firebase: ${errorMessage}. يمكنك إعداد Firebase يدوياً من Firebase Console.`);
                }
            } else if (!serviceAccountJson) {
                // If no Service Account provided, show info message
                showSuccess('✅ تم إنشاء المدير بنجاح! ملاحظة: لم يتم إدخال Service Account، يمكنك إعداد Firebase يدوياً من Firebase Console.');
            }

            // ✅ Financial documents are created automatically in createManager (Single Source of Truth)
            showSuccess(t('admin.addManagerSuccess'));

            // ✅ Dispatch event to refresh billing data in BillingDashboard
            window.dispatchEvent(new CustomEvent('manager-created'));
            window.dispatchEvent(new CustomEvent('billing-data-refresh'));

            onSuccess();
        } catch (err: any) {
            setError(err.message || t('admin.addError'));
            showError(err.message || t('admin.addManagerError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
            {/* Main Card - محسّن: ارتفاع ديناميكي بدون مساحة بيضاء فارغة */}
            <div className="glass-card relative w-full max-w-lg flex flex-col rounded-2xl overflow-hidden !p-0" style={{ maxHeight: '90vh' }}>

                {/* Header - مضموم */}
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-theme flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>{t('admin.addNewManager')}</h3>
                            <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{stepTitles[currentStep as keyof typeof stepTitles]}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors" style={{ color: 'var(--theme-text-secondary)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step Progress - مضموم */}
                <div className="px-4 py-2 flex gap-1.5 border-b border-theme flex-shrink-0">
                    {[1, 2, 3, 4].map((step) => (
                        <div key={step} className="flex-1">
                            <div className={`h-1.5 rounded-full mb-1 ${step < currentStep ? 'bg-teal-500' :
                                    step === currentStep ? 'bg-yellow-500' :
                                        'bg-gray-300 dark:bg-white/10'
                                }`} />
                            <span className="text-[9px] block text-center" style={{ color: step <= currentStep ? 'var(--theme-text-primary)' : 'var(--theme-text-disabled)' }}>
                                {step === 1 ? t('owner.stepBasic') : step === 2 ? t('owner.stepBranches') : step === 3 ? t('owner.stepSubscription') : t('owner.stepReview')}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Step Content - محسّن: محتوى مضموم بدون مساحة فارغة */}
                <div className="p-4 overflow-y-auto flex-1 min-h-0">
                    {/* ==================== STEP 1: Basic Info ==================== */}
                    {currentStep === 1 && (
                        <div className="space-y-3">
                            {/* الصف الأول: اسم المشترك + اسم الفندق */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <Users className="w-3.5 h-3.5 text-teal-500" />اسم المشترك <span className="text-red-500">*</span>
                                    </label>
                                    <input id="manager-name" name="managerName" type="text" value={name} onChange={e => setName(e.target.value)} className="input py-2 text-sm" placeholder={t('owner.exampleName') || 'أيمن أبو ورده'} required />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <Building className="w-3.5 h-3.5 text-purple-500" />اسم الفندق/البراند
                                    </label>
                                    <input id="hotel-name" name="hotelName" type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} className="input py-2 text-sm" placeholder="سلسلة فنادق الأهرام" />
                                </div>
                            </div>

                            {/* Phone Numbers - Grid Layout */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Primary Phone */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <MessageSquare className="w-3.5 h-3.5 text-green-500" />رقم الهاتف <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input id="manager-phone" name="managerPhone" type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))} className="input py-2 text-sm text-left pl-9" placeholder="05xxxxxxxx" dir="ltr" required />
                                        {phone.length >= 9 && <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"><CheckCircle className="w-4 h-4 text-green-500" /></div>}
                                    </div>
                                </div>
                                {/* Backup Phone */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <MessageSquare className="w-3.5 h-3.5 text-blue-400" />هاتف احتياطي <span className="text-[10px] opacity-70">(اختياري)</span>
                                    </label>
                                    <div className="relative">
                                        <input id="manager-phone-backup" name="managerPhoneBackup" type="tel" value={phoneBackup} onChange={e => setPhoneBackup(e.target.value.replace(/[^0-9+]/g, ''))} className="input py-2 text-sm text-left pl-9" placeholder="05xxxxxxxx" dir="ltr" />
                                        {phoneBackup.length >= 9 && <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"><CheckCircle className="w-4 h-4 text-blue-400" /></div>}
                                    </div>
                                </div>
                            </div>

                            {/* Manager Code */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Shield className="w-3.5 h-3.5 text-yellow-500" />كود المدير <span className="text-red-500">*</span> <span className="opacity-70">(4 أرقام)</span>
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            id="manager-code"
                                            name="managerCode"
                                            type="text"
                                            value={code}
                                            onChange={e => handleCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                            className={`input py-2 text-center text-xl font-mono tracking-[0.3em] pl-9 ${conflictingCodes.has(code) ? '!border-red-500 !bg-red-500/10' : code.length === 4 ? '!border-green-500 !bg-green-500/10' : ''}`}
                                            placeholder="• • • •"
                                            maxLength={4}
                                        />
                                        {checkingCodes && <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"><AdoraLoaderInline size={16} /></div>}
                                        {!checkingCodes && code.length === 4 && !conflictingCodes.has(code) && <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"><CheckCircle className="w-4 h-4 text-green-500" /></div>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleGenerateCode}
                                        disabled={generatingCode}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        title={t('admin.generateRandomCode') || 'توليد كود عشوائي فريد (4 أرقام)'}
                                    >
                                        {generatingCode ? (
                                            <AdoraLoaderInline size={16} />
                                        ) : (
                                            <>
                                                <RefreshCw className="w-4 h-4" />
                                                توليد
                                            </>
                                        )}
                                    </button>
                                </div>
                                {error && (error.includes(code) || error.includes('المدير')) && (
                                    <div className="mt-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                                        <p className="text-xs flex items-center gap-1.5 text-red-500"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== STEP 2: Branches ==================== */}
                    {currentStep === 2 && (
                        <div className="space-y-3">
                            <div className="p-2 rounded-lg flex items-center gap-2 bg-blue-500/10 border border-blue-500/30">
                                <Building className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>كل فرع: <strong>كود رقمي فريد</strong> 1–4 أرقام.</p>
                            </div>
                            <div className="glass rounded-xl p-3">
                                <label className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--theme-text-secondary)' }}><Plus className="w-3.5 h-3.5 text-teal-500" />{t('admin.addUpdate')} فرع</label>
                                <div className="flex gap-2">
                                    <input id="branch-code" name="branchCode" type="text" value={currentBranchCode} onChange={e => { let v=e.target.value.replace(/\D/g,''); if(v.startsWith('0'))v=v.slice(1); setCurrentBranchCode(v.slice(0,4)); }} maxLength={4} className={`input py-2 w-16 text-center font-mono text-sm ${conflictingCodes.has(currentBranchCode)?'!border-red-500':''}`} placeholder="كود" />
                                    <input id="branch-name" name="branchName" type="text" value={currentBranchName} onChange={e=>setCurrentBranchName(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleAddBranch()} className="input py-2 flex-1 text-sm" placeholder="اسم الفرع" />
                                    <button type="button" onClick={handleAddBranch} disabled={loading||!currentBranchCode.trim()||!currentBranchName.trim()} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 bg-teal-500 hover:bg-teal-600 flex items-center gap-1.5"><Plus className="w-4 h-4" />إضافة</button>
                                </div>
                                {error && (error.includes('كود الفرع')||error.includes('مستخدم')||error.includes('الفرع')) && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                            </div>
                            <div>
                                <label className="flex items-center justify-between text-xs mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}><Building2 className="w-3.5 h-3.5 text-purple-500" />الفروع المضافة {branchCodes.length>0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-600">{branchCodes.length}</span>}</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {branchCodes.length > 0 ? branchCodes.map((b, i) => (
                                        <div key={b.code} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                            <span className="w-5 h-5 rounded text-white text-[10px] flex items-center justify-center font-bold bg-teal-500">{i+1}</span>
                                            <span className="text-xs font-medium" style={{ color: 'var(--theme-text-primary)' }}>{b.name}</span><span className="text-[10px] font-mono opacity-70">{b.code}</span>
                                            <button type="button" onClick={()=>handleRemoveBranch(b.code)} className="w-5 h-5 rounded flex items-center justify-center text-red-500 hover:bg-red-500/10"><X className="w-3 h-3" /></button>
                                        </div>
                                    )) : (
                                        <div className="w-full text-center py-4 rounded-xl glass border-2 border-dashed">
                                            <Building className="w-6 h-6 mx-auto mb-1 opacity-50" style={{ color: 'var(--theme-text-disabled)' }} />
                                            <p className="text-xs" style={{ color: 'var(--theme-text-disabled)' }}>لا توجد فروع</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== STEP 3: Subscription & Payment ==================== */}
                    {currentStep === 3 && (
                        <div className="space-y-3">
                            <div>
                                <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}><CreditCard className="w-3.5 h-3.5 text-green-500" />{t('billing.vouchers.paymentMethod')}</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    {[{ value: 'cash', label: t('billing.paymentMethods.cash'), icon: '💵' }, { value: 'credit', label: t('billing.paymentMethods.credit'), icon: '💳' }, { value: 'bank_transfer', label: t('billing.paymentMethods.bankTransfer'), icon: '🏦' }, { value: 'deferred', label: t('billing.paymentMethods.deferred'), icon: '⏳' }].map((m) => (
                                        <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value as any)} className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-0.5 border ${paymentMethod === m.value ? 'border-teal-500 bg-teal-500/10' : 'border-theme glass'}`} style={{ color: 'var(--theme-text-primary)' }}><span>{m.icon}</span><span>{m.label}</span></button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}><Calendar className="w-3.5 h-3.5 text-yellow-500" />{t('owner.subscriptionDuration')}</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setSubscriptionDuration(1)} className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border text-sm ${subscriptionDuration === 1 ? 'border-teal-500 bg-teal-500/10' : 'border-theme glass'}`} style={{ color: 'var(--theme-text-primary)' }}>📅 سنة</button>
                                    <button type="button" onClick={() => setSubscriptionDuration(2)} className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border text-sm relative ${subscriptionDuration === 2 ? 'border-yellow-500 bg-yellow-500/10' : 'border-theme glass'}`} style={{ color: 'var(--theme-text-primary)' }}><span className="absolute top-0.5 left-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500 text-white">توفير</span>📅📅 سنتين</button>
                                </div>
                            </div>
                            {systemSettings && (() => {
                                const pricePerBranch = systemSettings.defaultSubscriptionPrice || 0;
                                const numberOfBranches = branchCodes.length;
                                const taxRate = (systemSettings.defaultTaxRate || 15) / 100;
                                
                                // ✅ Calculate base amount (same logic as ownerService.ts)
                                // pricePerBranch is already including tax
                                const baseAmount = pricePerBranch * subscriptionDuration * numberOfBranches;
                                
                                // ✅ Apply 2-year discount if applicable
                                let discountAmount = 0;
                                let discountRate = 0;
                                if (subscriptionDuration === 2 && systemSettings.twoYearDiscountRate) {
                                    discountRate = systemSettings.twoYearDiscountRate;
                                    discountAmount = (baseAmount * discountRate) / 100;
                                }
                                
                                // ✅ Final total after discount (same as ownerService.ts: totalAmount = baseAmount - discountAmount)
                                const finalTotal = baseAmount - discountAmount;
                                
                                // ✅ Extract tax breakdown for display (pricePerBranch includes tax, so we reverse calculate)
                                // If pricePerBranch includes tax: priceBeforeTax = pricePerBranch / (1 + taxRate)
                                const priceBeforeTaxPerBranch = pricePerBranch / (1 + taxRate);
                                const baseAmountBeforeTax = priceBeforeTaxPerBranch * subscriptionDuration * numberOfBranches;
                                const discountAmountBeforeTax = discountAmount / (1 + taxRate);
                                const amountAfterDiscountBeforeTax = baseAmountBeforeTax - discountAmountBeforeTax;
                                const taxAmount = finalTotal - amountAfterDiscountBeforeTax;
                                
                                return (
                                    <div className="glass rounded-xl p-3 space-y-2">
                                        {/* Basic Info */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>الفرع / سنة:</span>
                                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{pricePerBranch.toLocaleString()} ر.س</span>
                                        </div>
                                        
                                        {/* Subscription Duration Info */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>{t('owner.numberOfBranches')}:</span>
                                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{numberOfBranches} {numberOfBranches === 1 ? t('admin.branch') : t('admin.branches')}</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>{t('owner.subscriptionDuration')}:</span>
                                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{subscriptionDuration === 1 ? t('billing.subscription.oneYearFull') : t('billing.subscription.twoYearsFull')}</span>
                                        </div>
                                        
                                        {/* Original Price (2 years) */}
                                        {subscriptionDuration === 2 && (
                                            <div className="flex justify-between items-center text-xs pt-1 border-t border-white/10">
                                                <span style={{ color: 'var(--theme-text-secondary)' }}>السعر الأصلي ({subscriptionDuration} سنوات):</span>
                                                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{baseAmount.toLocaleString()} ر.س</span>
                                            </div>
                                        )}
                                        
                                        {/* Discount Info (only if 2 years and discount exists) */}
                                        {subscriptionDuration === 2 && discountAmount > 0 && (
                                            <>
                                                <div className="flex justify-between items-center text-xs bg-primary-500/10 rounded-lg p-2 border border-primary-500/30">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="text-[10px]">✨</span>
                                                        <span style={{ color: 'var(--theme-text-secondary)' }}>خصم {discountRate}%:</span>
                                                    </span>
                                                    <span className="font-bold text-red-400">-{Math.round(discountAmount).toLocaleString()} ر.س</span>
                                                </div>
                                                
                                                <div className="flex justify-between items-center text-xs">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>السعر بعد الخصم (قبل الضريبة):</span>
                                                    <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{Math.round(amountAfterDiscountBeforeTax).toLocaleString()} ر.س</span>
                                                </div>
                                                
                                                <div className="flex justify-between items-center text-xs">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>قيمة الضريبة ({systemSettings.defaultTaxRate || 15}%):</span>
                                                    <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{Math.round(taxAmount).toLocaleString()} ر.س</span>
                                                </div>
                                            </>
                                        )}
                                        
                                        {/* Final Total */}
                                        <div className="flex justify-between items-center text-sm pt-2 border-t-2 border-primary-500/30 mt-1">
                                            <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>الإجمالي النهائي:</span>
                                            <span className="font-bold text-primary-500">{Math.round(finalTotal).toLocaleString()} ر.س</span>
                                        </div>
                                        
                                        {/* Info Message for 2-year discount */}
                                        {subscriptionDuration === 2 && discountAmount > 0 && (
                                            <div className="mt-2 p-2 rounded-lg bg-primary-500/10 border border-primary-500/30">
                                                <p className="text-[10px] flex items-center gap-1.5 text-primary-500">
                                                    <span>ℹ️</span>
                                                    <span>سيتم تطبيق خصم {discountRate}% تلقائياً عند الحفظ</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {/* ✅ Firebase Config - REQUIRED with Step-by-Step Guide */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                                        <Server className="w-3.5 h-3.5 text-primary-500" />
                                        إعدادات Firebase <span className="text-red-500">*</span> <span className="text-[10px] font-normal opacity-70">(إجباري)</span>
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowFirebaseConfig(s => !s)} 
                                        className="text-[10px] px-2 py-1 rounded-lg border border-primary-500/30 bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors"
                                    >
                                        {showFirebaseConfig ? '▲ إخفاء' : '▼ عرض'}
                                    </button>
                                </div>
                                
                                {/* Step-by-Step Guide */}
                                {!showFirebaseConfig && (
                                    <div className="glass rounded-xl p-3 space-y-2 border-2 border-primary-500/30 bg-primary-500/5">
                                        <div className="flex items-start gap-2">
                                            <span className="text-primary-500 font-bold text-xs mt-0.5">1️⃣</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>افتح Firebase Console</p>
                                                <p className="text-[10px] opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    اذهب إلى <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary-500 underline">console.firebase.google.com</a> وأنشئ مشروع جديد
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-primary-500 font-bold text-xs mt-0.5">2️⃣</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>احصل على Firebase Config</p>
                                                <p className="text-[10px] opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    Project Settings → General → Your apps → Web app → Copy config
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-primary-500 font-bold text-xs mt-0.5">3️⃣</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>احصل على Service Account Key</p>
                                                <p className="text-[10px] opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    Project Settings → Service Accounts → Generate new private key → Download JSON
                                                </p>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-primary-500/20">
                                            <p className="text-[10px] text-primary-500 flex items-center gap-1.5">
                                                <Info className="w-3 h-3" />
                                                <span>سيقوم النظام بإعداد Authentication و Firestore Rules و Storage تلقائياً</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                                
                                {showFirebaseConfig && (
                                    <div className="space-y-3">
                                        <TenantFirebaseConfig 
                                            config={firebaseConfig} 
                                            onChange={setFirebaseConfig} 
                                            disabled={loading} 
                                            compact={true} 
                                            showTestButton={true}
                                            showServiceAccount={true}
                                            onTestResult={(s) => setFirebaseTestPassed(s)} 
                                        />
                                        
                                        {/* Validation Message */}
                                        {(!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.authDomain || !firebaseConfig.storageBucket) && (
                                            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                                                <p className="text-[10px] text-red-400 flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    <span>يجب إدخال جميع الحقول المطلوبة: apiKey, projectId, authDomain, storageBucket</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== STEP 4: Review & Save ==================== */}
                    {currentStep === 4 && (
                        <div className="space-y-3">
                            <div className="p-2 rounded-lg flex items-center gap-2 bg-green-500/10 border border-green-500/30">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }} dangerouslySetInnerHTML={{ __html: t('admin.reviewDataBeforeFinalSave') }} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="glass rounded-xl p-2">
                                    <h4 className="text-[10px] font-bold mb-1 text-teal-500">{t('admin.basicData')}</h4>
                                    <div className="grid grid-cols-1 gap-0.5 text-xs"><span style={{ color: 'var(--theme-text-primary)' }}>{name || '-'}</span><span dir="ltr" style={{ color: 'var(--theme-text-primary)' }}>{phone}</span><span className="font-mono text-teal-500">{code}</span></div>
                                </div>
                                <div className="glass rounded-xl p-2">
                                    <h4 className="text-[10px] font-bold mb-1 text-purple-500">الفروع ({branchCodes.length})</h4>
                                    <div className="flex flex-wrap gap-1">{branchCodes.map((b,i)=><span key={b.code} className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/10 border border-teal-500/20">{b.name}</span>)}</div>
                                </div>
                            </div>
                            {systemSettings && (() => {
                                const pricePerBranch = systemSettings.defaultSubscriptionPrice || 0;
                                const numberOfBranches = branchCodes.length;
                                const taxRate = (systemSettings.defaultTaxRate || 15) / 100;
                                
                                // ✅ Calculate base amount (same logic as ownerService.ts)
                                // pricePerBranch is already including tax
                                const baseAmount = pricePerBranch * subscriptionDuration * numberOfBranches;
                                
                                // ✅ Apply 2-year discount if applicable
                                let discountAmount = 0;
                                let discountRate = 0;
                                if (subscriptionDuration === 2 && systemSettings.twoYearDiscountRate) {
                                    discountRate = systemSettings.twoYearDiscountRate;
                                    discountAmount = (baseAmount * discountRate) / 100;
                                }
                                
                                // ✅ Final total after discount (same as ownerService.ts: totalAmount = baseAmount - discountAmount)
                                const finalTotal = baseAmount - discountAmount;
                                
                                // ✅ Extract tax breakdown for display (pricePerBranch includes tax, so we reverse calculate)
                                const priceBeforeTaxPerBranch = pricePerBranch / (1 + taxRate);
                                const baseAmountBeforeTax = priceBeforeTaxPerBranch * subscriptionDuration * numberOfBranches;
                                const discountAmountBeforeTax = discountAmount / (1 + taxRate);
                                const amountAfterDiscountBeforeTax = baseAmountBeforeTax - discountAmountBeforeTax;
                                const taxAmount = finalTotal - amountAfterDiscountBeforeTax;
                                
                                return (
                                    <div className="glass rounded-xl p-3 space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>{subscriptionDuration===1 ? t('billing.subscription.oneYear') : t('billing.subscription.twoYears')} • {paymentMethod==='cash' ? t('billing.paymentMethods.cash') : paymentMethod==='credit' ? t('billing.paymentMethods.credit') : paymentMethod==='bank_transfer' ? t('billing.paymentMethods.bankTransfer') : t('billing.paymentMethods.deferred')}</span>
                                            <span className="font-bold text-primary-500">{Math.round(finalTotal).toLocaleString()} ر.س</span>
                                        </div>
                                        
                                        {/* Show discount details if applicable */}
                                        {subscriptionDuration === 2 && discountAmount > 0 && (
                                            <div className="pt-2 border-t border-white/10 space-y-1">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>السعر الأصلي:</span>
                                                    <span style={{ color: 'var(--theme-text-primary)' }}>{baseAmount.toLocaleString()} ر.س</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>خصم {discountRate}%:</span>
                                                    <span className="text-red-400">-{Math.round(discountAmount).toLocaleString()} ر.س</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>قيمة الضريبة ({systemSettings.defaultTaxRate || 15}%):</span>
                                                    <span style={{ color: 'var(--theme-text-primary)' }}>{Math.round(taxAmount).toLocaleString()} ر.س</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {firebaseConfig.apiKey && <div className="text-[10px] flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Firebase منفصل</div>}
                            {error && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30"><p className="text-xs flex items-center gap-1.5 text-red-500"><AlertTriangle className="w-3.5 h-3.5" />{error}</p></div>}
                        </div>
                    )}
                </div>

                {/* Footer - مضموم */}
                <div className="px-4 py-2.5 border-t border-theme flex-shrink-0">
                    <div className="flex gap-2">
                        {currentStep > 1 && (
                            <button type="button" onClick={handleBack} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 glass border border-theme" style={{ color: 'var(--theme-text-primary)' }}>
                                <ChevronRight className="w-4 h-4 rotate-180" />رجوع
                            </button>
                        )}
                        {currentStep < TOTAL_STEPS ? (
                            <button type="button" onClick={handleNext} disabled={!canGoNext()} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 bg-teal-500 hover:bg-teal-600 text-white">
                                التالي<ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 bg-teal-500 hover:bg-teal-600 text-white">
                                {loading ? <AdoraLoaderInline size={18} /> : <><Save className="w-4 h-4" />{t('admin.saveAndCreate')}</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Manager Details Modal Component - ✅ Enhanced for Light Mode + Print
const ManagerDetailsModal: React.FC<{
    tenant: TenantAnalytics;
    managerDetails: any;
    loading: boolean;
    onClose: () => void;
}> = ({ tenant, managerDetails, loading, onClose }) => {
    const { t } = useTranslation();
    const [activeBranchTab, setActiveBranchTab] = useState<string | null>(
        managerDetails.branches.length > 0 ? managerDetails.branches[0].id : null
    );

    const activeBranch = managerDetails.branches.find((b: any) => b.id === activeBranchTab);

    const featureLabels: Record<string, string> = {
        qrCodeGuestPortal: 'بوابة النزيل (QR)',
        pointsSystem: 'نظام النقاط',
        gamification: 'الشارات والرتب',
        shiftNotes: 'ملاحظات الشيفت',
        scheduledTasks: 'المهام المجدولة',
        aiAssistant: 'المساعد الذكي',
        calendarSync: 'مزامنة التقويم',
        inventoryManagement: 'إدارة المخزون',
        procurementSystem: 'نظام المشتريات',
        laundryManagement: 'إدارة المغسلة',
        whatsappIntegration: 'تكامل واتساب',
        emailNotifications: 'إشعارات البريد',
        smsNotifications: 'إشعارات SMS'
    };

    const createdAt = managerDetails.createdAt?.toDate
        ? managerDetails.createdAt.toDate()
        : managerDetails.createdAt instanceof Timestamp
            ? managerDetails.createdAt.toDate()
            : new Date(managerDetails.createdAt || Date.now());

    // ✅ Print subscription report
    const handlePrint = () => {
        const printContent = document.getElementById('subscription-report-content');
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>تقرير اشتراك - ${tenant.tenantName}</title>
                <style>
                    * { font-family: 'Segoe UI', Tahoma, sans-serif; box-sizing: border-box; }
                    body { padding: 40px; background: white; color: #1e293b; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { color: #0d9488; margin: 0 0 10px 0; font-size: 28px; }
                    .header p { color: #64748b; margin: 5px 0; }
                    .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
                    .section h3 { color: #0d9488; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin: 0 0 15px 0; }
                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                    .stat { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .stat-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
                    .stat-value { font-size: 18px; font-weight: bold; color: #1e293b; }
                    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
                    .badge-green { background: #dcfce7; color: #166534; }
                    .badge-yellow { background: #fef3c7; color: #92400e; }
                    .badge-red { background: #fee2e2; color: #991b1b; }
                    .features { display: flex; flex-wrap: wrap; gap: 8px; }
                    .feature-tag { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 15px; font-size: 11px; }
                    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏨 تقرير اشتراك Adora</h1>
                    <p><strong>${tenant.tenantName}</strong></p>
                    <p>كود المدير: ${managerDetails.manager.code || 'غير متوفر'} • ${managerDetails.branches.length} فرع</p>
                    <p>تاريخ التقرير: ${formatDateGregorianEn(new Date(), 'long')}</p>
                </div>
                
                <div class="section">
                    <h3>📋 معلومات الاشتراك</h3>
                    <div class="grid">
                        <div class="stat">
                            <div class="stat-label">${t('admin.accountCreationDate')}</div>
                            <div class="stat-value">${formatDateGregorianEn(createdAt)}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">مدة الاشتراك</div>
                            <div class="stat-value">${Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))} يوم</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">${t('admin.plan')}</div>
                            <div class="stat-value">${tenant.plan}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">${t('admin.licenseStatus')}</div>
                            <div class="stat-value">
                                <span class="badge ${tenant.daysUntilExpiry > 30 ? 'badge-green' : tenant.daysUntilExpiry > 7 ? 'badge-yellow' : 'badge-red'}">
                                    ${tenant.daysUntilExpiry > 0 ? t('admin.daysRemaining', { days: tenant.daysUntilExpiry }) : t('admin.expired')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                ${managerDetails.branches.map((branch: any) => `
                    <div class="section">
                        <h3>🏢 فرع: ${branch.name || branch.id}</h3>
                        <div class="grid">
                            <div class="stat">
                                <div class="stat-label">${t('admin.employeesCount')}</div>
                                <div class="stat-value">${branch.employeesCount || 0}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">${t('admin.totalRequests')}</div>
                                <div class="stat-value">${branch.totalRequests || 0}</div>
                            </div>
                        </div>
                        ${branch.enabledFeatures?.length > 0 ? `
                            <div style="margin-top: 15px;">
                                <div class="stat-label">المميزات المفعلة:</div>
                                <div class="features" style="margin-top: 8px;">
                                    ${branch.enabledFeatures.map((f: string) => `<span class="feature-tag">${featureLabels[f] || f}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}

                <div class="footer">
                    <p>تم إنشاء هذا التقرير بواسطة نظام Adora لإدارة الفنادق</p>
                    <p>© ${new Date().getFullYear()} Adora Hotel Management System</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl overflow-hidden max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex-shrink-0 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-transparent dark:to-transparent">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white truncate max-w-[200px] sm:max-w-none">{tenant.tenantName}</h3>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60">
                                كود المدير: <span className="font-mono font-bold">{managerDetails.manager.code || 'غير متوفر'}</span> • {managerDetails.branches.length} فرع
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Print Button */}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-500/30 transition-colors border border-teal-300 dark:border-teal-500/30"
                            title={t('admin.printSubscriptionReport') || 'طباعة تقرير الاشتراك'}
                        >
                            <Printer className="w-5 h-5" />
                            <span className="hidden sm:inline">طباعة</span>
                        </button>
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div id="subscription-report-content" className="p-4 sm:p-5 lg:p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-transparent">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" showMessage={false} />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Manager Lifecycle */}
                            <div className="bg-white dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                                    {t('admin.managerLifecycle')}
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.accountCreationDate')}</p>
                                        <p className="text-slate-800 dark:text-white font-medium">
                                            {formatDateTimeGregorianEn(createdAt, { dateStyle: 'long', showSeconds: false })}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">مدة الاشتراك</p>
                                        <p className="text-slate-800 dark:text-white font-medium">
                                            {Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))} يوم
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.plan')}</p>
                                        <p className="text-slate-800 dark:text-white font-medium capitalize">{tenant.plan}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.licenseStatus')}</p>
                                        <p className={`font-medium ${tenant.daysUntilExpiry > 30 ? 'text-green-600 dark:text-green-400' : tenant.daysUntilExpiry > 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {tenant.daysUntilExpiry > 0 ? t('admin.daysRemaining', { days: tenant.daysUntilExpiry }) : t('admin.expired')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Branches Tabs */}
                            {managerDetails.branches.length > 1 ? (
                                <div className="bg-white dark:bg-slate-800/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                    <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                                        الفروع ({managerDetails.branches.length})
                                    </h4>
                                    <div className="flex gap-2 mb-4 overflow-x-auto">
                                        {managerDetails.branches.map((branch: any) => (
                                            <button
                                                key={branch.id}
                                                onClick={() => setActiveBranchTab(branch.id)}
                                                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeBranchTab === branch.id
                                                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30'
                                                        : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-slate-700/50'
                                                    }`}
                                            >
                                                {branch.name || branch.id}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Active Branch Details */}
                            {activeBranch && (
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                        <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                                            {activeBranch.name || activeBranch.id}
                                        </h4>

                                        {/* Branch Stats */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-5 lg:mb-6">
                                            <div className="bg-blue-50 dark:bg-slate-800/60 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200 dark:border-blue-500/30">
                                                <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.employeesCount')}</p>
                                                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.employeesCount || 0}</p>
                                            </div>
                                            <div className="bg-teal-50 dark:bg-slate-800/60 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-teal-200 dark:border-teal-500/30">
                                                <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.totalRequests')}</p>
                                                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.totalRequests || 0}</p>
                                            </div>
                                            <div className="bg-purple-50 dark:bg-slate-800/60 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-purple-200 dark:border-purple-500/30">
                                                <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.topDepartment')}</p>
                                                <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">{activeBranch.topDepartment}</p>
                                            </div>
                                        </div>

                                        {/* Department Breakdown */}
                                        {activeBranch.departmentCounts && Object.keys(activeBranch.departmentCounts).length > 0 && (
                                            <div className="mb-6">
                                                <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">توزيع الطلبات حسب الأقسام:</p>
                                                <div className="space-y-2">
                                                    {Object.entries(activeBranch.departmentCounts)
                                                        .sort(([, a], [, b]) => (b as number) - (a as number))
                                                        .map(([dept, count]) => (
                                                            <div key={dept} className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
                                                                <span className="text-slate-700 dark:text-white/80">{dept}</span>
                                                                <span className="text-blue-600 dark:text-blue-400 font-bold">{count as number}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Enabled Features */}
                                        {activeBranch.enabledFeatures && activeBranch.enabledFeatures.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">المميزات المفعلة:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {activeBranch.enabledFeatures.map((feature: string) => (
                                                        <span
                                                            key={feature}
                                                            className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-xs border border-green-300 dark:border-green-500/30"
                                                        >
                                                            {featureLabels[feature] || feature}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Single Branch View */}
                            {managerDetails.branches.length === 1 && activeBranch && (
                                <div className="bg-white dark:bg-slate-800/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                                    <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        {activeBranch.name || activeBranch.id}
                                    </h4>

                                    {/* Same content as above */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-blue-50 dark:bg-slate-800/60 rounded-xl p-4 border border-blue-200 dark:border-blue-500/30">
                                            <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.employeesCount')}</p>
                                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.employeesCount || 0}</p>
                                        </div>
                                        <div className="bg-teal-50 dark:bg-slate-800/60 rounded-xl p-4 border border-teal-200 dark:border-teal-500/30">
                                            <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.totalRequests')}</p>
                                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.totalRequests || 0}</p>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-slate-800/60 rounded-xl p-4 border border-purple-200 dark:border-purple-500/30">
                                            <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.topDepartment')}</p>
                                            <p className="text-lg font-bold text-slate-800 dark:text-white">{activeBranch.topDepartment}</p>
                                        </div>
                                    </div>

                                    {activeBranch.departmentCounts && Object.keys(activeBranch.departmentCounts).length > 0 && (
                                        <div className="mb-6">
                                            <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">توزيع الطلبات حسب الأقسام:</p>
                                            <div className="space-y-2">
                                                {Object.entries(activeBranch.departmentCounts)
                                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                                    .map(([dept, count]) => (
                                                        <div key={dept} className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200 dark:border-slate-700/50">
                                                            <span className="text-slate-700 dark:text-white/80">{dept}</span>
                                                            <span className="text-blue-600 dark:text-blue-400 font-bold">{count as number}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeBranch.enabledFeatures && activeBranch.enabledFeatures.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">المميزات المفعلة:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {activeBranch.enabledFeatures.map((feature: string) => (
                                                    <span
                                                        key={feature}
                                                        className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-xs border border-green-300 dark:border-green-500/30"
                                                    >
                                                        {featureLabels[feature] || feature}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// SUBSCRIPTION REQUESTS TAB COMPONENT
// ============================================================

const SubscriptionRequestsTab: React.FC = () => {
    const { success, error } = useUX();
    const { t } = useTranslation();
    const [requests, setRequests] = useState<TrialRequest[]>([]);
    const [deletedRequests, setDeletedRequests] = useState<DeletedTrialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDeleted, setLoadingDeleted] = useState(false);
    const [filter, setFilter] = useState<'all' | 'contacted' | 'not-contacted' | 'deleted'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'branches-high' | 'branches-low'>('newest');
    const [showContactModal, setShowContactModal] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<TrialRequest | null>(null);
    const [contactResult, setContactResult] = useState<'demo' | 'thinking' | 'wrong' | 'other'>('demo');
    const [contactNotes, setContactNotes] = useState('');
    const [followUpNote, setFollowUpNote] = useState('');

    // Fetch requests + deleted count (for stats card)
    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            try {
                const [reqResult, deletedResult] = await Promise.all([
                    getAllTrialRequests(),
                    getDeletedTrialRequests(),
                ]);
                if (reqResult.success && reqResult.data) {
                    setRequests(reqResult.data);
                } else {
                    const errorMsg = reqResult.error || t('common.error');
                    const isPermissionError = errorMsg.toLowerCase().includes('permission') || 
                                             errorMsg.toLowerCase().includes('missing or insufficient') ||
                                             errorMsg.toLowerCase().includes('unauthorized');
                    if (isPermissionError) error(t('admin.permissionError'));
                    else error(errorMsg);
                }
                if (deletedResult.success && deletedResult.data) {
                    setDeletedRequests(deletedResult.data);
                }
            } catch (err: any) {
                const errorMsg = err.message || 'حدث خطأ أثناء جلب الطلبات';
                const isPermissionError = errorMsg.toLowerCase().includes('permission') || 
                                         errorMsg.toLowerCase().includes('missing or insufficient') ||
                                         errorMsg.toLowerCase().includes('unauthorized');
                if (isPermissionError) error(t('admin.permissionErrorGeneral'));
                else error(errorMsg);
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // ✅ Only run once on mount - t and error are stable functions

    // Fetch deleted when user switches to "المحذوفة" tab
    useEffect(() => {
        if (filter !== 'deleted') return;
        const fetchDeleted = async () => {
            setLoadingDeleted(true);
            try {
                const result = await getDeletedTrialRequests();
                if (result.success && result.data) setDeletedRequests(result.data);
                else if (result.error) error(result.error);
            } catch (err: any) {
                error(err?.message || 'فشل جلب سجل المحذوفات');
            } finally {
                setLoadingDeleted(false);
            }
        };
        fetchDeleted();
    }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

    // Filter and sort requests
    const filteredRequests = useMemo(() => {
        // ✅ FIX: Null safety check
        if (!requests || !Array.isArray(requests)) {
            return [];
        }
        
        let result = [...requests];
        
        // Apply filter
        if (filter === 'contacted') {
            result = result.filter(req => req.contactedAt);
        } else if (filter === 'not-contacted') {
            result = result.filter(req => !req.contactedAt);
        }
        
        // Apply sort
        result.sort((a, b) => {
            if (sortBy === 'newest') {
                const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return bDate.getTime() - aDate.getTime(); // Newest first
            } else if (sortBy === 'oldest') {
                const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return aDate.getTime() - bDate.getTime(); // Oldest first
            } else if (sortBy === 'branches-high') {
                const aBranches = a.requiredBranches || 0;
                const bBranches = b.requiredBranches || 0;
                return bBranches - aBranches; // Highest first
            } else if (sortBy === 'branches-low') {
                const aBranches = a.requiredBranches || 0;
                const bBranches = b.requiredBranches || 0;
                return aBranches - bBranches; // Lowest first
            }
            return 0;
        });
        
        return result;
    }, [requests, filter, sortBy]);

    // ميلادي فقط، أرقام إنجليزي
    const formatDate = useCallback((dateValue: any): string => {
        if (!dateValue) return t('admin.undefined');
        try {
            return formatDateGregorianEn(dateValue, 'long');
        } catch {
            return t('admin.undefined');
        }
    }, [t]);

    const [requestIdToDelete, setRequestIdToDelete] = useState<string | null>(null);
    const handleConfirmDelete = async (requestId: string) => {
        const result = await deleteTrialRequest(requestId);
        if (result.success) {
            success('تم حذف الطلب');
            setRequestIdToDelete(null);
            const [refreshResult, deletedResult] = await Promise.all([
                getAllTrialRequests(),
                getDeletedTrialRequests(),
            ]);
            if (refreshResult.success && refreshResult.data) setRequests(refreshResult.data);
            if (deletedResult.success && deletedResult.data) setDeletedRequests(deletedResult.data);
        } else {
            error(result.error || 'فشل الحذف');
        }
    };

    // Handle mark as contacted - Open modal first
    const handleMarkAsContacted = (requestId: string) => {
        setSelectedRequestId(requestId);
        setContactResult('demo');
        setContactNotes('');
        setShowContactModal(true);
    };

    // Submit contact result
    const handleSubmitContact = async () => {
        if (!selectedRequestId) return;

        // ✅ Validate required notes
        if (!contactNotes || !contactNotes.trim()) {
            error('الملاحظات مطلوبة');
            return;
        }

        try {
            const result = await markTrialRequestAsContacted(selectedRequestId, contactResult, contactNotes);
            if (result.success) {
                success('تم حفظ نتيجة الاتصال بنجاح');
                setShowContactModal(false);
                setSelectedRequestId(null);
                setContactResult('demo');
                setContactNotes('');
                // Refresh requests
                const refreshResult = await getAllTrialRequests();
                if (refreshResult.success && refreshResult.data) {
                    setRequests(refreshResult.data);
                }
            } else {
                error(result.error || 'فشل حفظ نتيجة الاتصال');
            }
        } catch (err: any) {
            error(err.message || 'حدث خطأ أثناء الحفظ');
        }
    };

    // View contact notes
    const handleViewNotes = (request: TrialRequest) => {
        setSelectedRequest(request);
        setShowNotesModal(true);
    };

    // Print request details
    const handlePrintRequest = (request: TrialRequest) => {
        // Create a printable HTML content
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const requestCreatedDate = formatDate(request.createdAt);
        const requestContactedDate = request.contactedAt ? formatDate(request.contactedAt) : '';
        const printDate = formatDateGregorianEn(new Date(), 'long');

        const contactResultText = {
            'demo': 'طلب ديمو',
            'thinking': 'طلب مهلة تفكير',
            'wrong': 'طلب خاطئ',
            'other': 'طلب آخر'
        }[request.contactResult || 'other'] || 'غير محدد';

        // ✅ FIX: Format follow-up dates before template string to avoid closure issues
        const followUpsHtml = request.followUps && request.followUps.length > 0
            ? request.followUps.map((followUp, index) => {
                const followUpDate = followUp.createdAt?.toDate 
                    ? followUp.createdAt.toDate() 
                    : followUp.createdAt instanceof Date 
                        ? followUp.createdAt 
                        : new Date(followUp.createdAt || Date.now());
                // ✅ Format date before template string
                const formattedFollowUpDate = formatDateGregorianEn(followUpDate, 'long');
                return `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${index + 1}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formattedFollowUpDate}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${followUp.note || 'لا توجد ملاحظات'}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #999;">لا توجد ملاحظات متابعة</td></tr>';

        const htmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>تفاصيل طلب الاشتراك - ${request.name}</title>
                <style>
                    @media print {
                        body { margin: 0; padding: 20px; }
                        .no-print { display: none; }
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        direction: rtl;
                        padding: 20px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 3px solid #20b2aa;
                        padding-bottom: 20px;
                    }
                    .header h1 {
                        color: #20b2aa;
                        margin: 0;
                        font-size: 28px;
                    }
                    .header p {
                        color: #666;
                        margin: 5px 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        background: white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    th {
                        background: linear-gradient(to right, #20b2aa, #0d9488);
                        color: white;
                        padding: 12px;
                        text-align: right;
                        font-weight: bold;
                        border: 1px solid #0d9488;
                    }
                    td {
                        padding: 10px;
                        border: 1px solid #ddd;
                        text-align: right;
                    }
                    tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    .section-title {
                        background: #f0f0f0;
                        font-weight: bold;
                        color: #20b2aa;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 2px solid #ddd;
                        color: #666;
                        font-size: 12px;
                    }
                    .print-btn {
                        position: fixed;
                        top: 20px;
                        left: 20px;
                        padding: 12px 24px;
                        background: #20b2aa;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        box-shadow: 0 4px 12px rgba(32, 178, 170, 0.3);
                        z-index: 1000;
                    }
                    .print-btn:hover {
                        background: #0d9488;
                    }
                </style>
            </head>
            <body>
                <button class="print-btn no-print" onclick="window.print()">🖨️ طباعة</button>
                
                <div class="header">
                    <h1>تفاصيل طلب الاشتراك</h1>
                    <p>نظام Adora لإدارة الفنادق</p>
                    <p>تاريخ الطباعة: ${printDate}</p>
                </div>

                <table>
                    <tr>
                        <th colspan="2" class="section-title">معلومات المشترك</th>
                    </tr>
                    <tr>
                        <td style="width: 30%; font-weight: bold;">الاسم</td>
                        <td>${request.name || 'غير متوفر'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">رقم الهاتف</td>
                        <td>${request.phone || 'غير متوفر'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">عدد التراخيص المطلوبة</td>
                        <td>${request.requiredBranches || 1} ترخيص (${request.requiredBranches || 1} فرع)</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">مصدر الطلب</td>
                        <td>${request.source === 'about_us_page' ? 'صفحة About Us' : request.source || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">تاريخ الطلب</td>
                        <td>${requestCreatedDate}</td>
                    </tr>
                </table>

                <table>
                    <tr>
                        <th colspan="2" class="section-title">معلومات الاتصال</th>
                    </tr>
                    <tr>
                        <td style="width: 30%; font-weight: bold;">حالة الاتصال</td>
                        <td>${request.contactedAt ? 'تم التواصل معه' : 'لم يتم التواصل معه'}</td>
                    </tr>
                    ${request.contactedAt ? `
                    <tr>
                        <td style="font-weight: bold;">تاريخ الاتصال</td>
                        <td>${requestContactedDate}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">نوع الطلب</td>
                        <td>${contactResultText}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">ملاحظات الاتصال</td>
                        <td>${request.contactNotes || 'لا توجد ملاحظات'}</td>
                    </tr>
                    ` : '<tr><td colspan="2" style="text-align: center; color: #999;">لم يتم التواصل مع المشترك بعد</td></tr>'}
                </table>

                ${request.followUps && request.followUps.length > 0 ? `
                <table>
                    <tr>
                        <th colspan="3" class="section-title">سجل المتابعة</th>
                    </tr>
                    <tr>
                        <th style="width: 10%;">#</th>
                        <th style="width: 30%;">التاريخ</th>
                        <th style="width: 60%;">الملاحظة</th>
                    </tr>
                    ${followUpsHtml}
                </table>
                ` : ''}

                <div class="footer">
                    <p>تم إنشاء هذا التقرير تلقائياً من نظام Adora لإدارة الفنادق</p>
                    <p>© ${new Date().getFullYear()} Adora Platform - جميع الحقوق محفوظة</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load, then trigger print
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    // Submit follow-up
    const handleSubmitFollowUp = async () => {
        if (!selectedRequestId || !followUpNote || !followUpNote.trim()) {
            error('ملاحظة المتابعة مطلوبة');
            return;
        }

        try {
            const result = await addFollowUpToTrialRequest(selectedRequestId, followUpNote);
            if (result.success) {
                success('تم إضافة ملاحظة المتابعة بنجاح');
                setShowFollowUpModal(false);
                setSelectedRequestId(null);
                setFollowUpNote('');
                // Refresh requests
                const refreshResult = await getAllTrialRequests();
                if (refreshResult.success && refreshResult.data) {
                    setRequests(refreshResult.data);
                }
            } else {
                error(result.error || 'فشل إضافة ملاحظة المتابعة');
            }
        } catch (err: any) {
            error(err.message || 'حدث خطأ أثناء الحفظ');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <AdoraLoaderInline />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header - تحديث القائمة يتم من زر "تحديث" في أعلى الصفحة (لا تكرار) */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">{t('admin.subscriptionRequests')}</h2>
                    <p className="text-white/60">{t('admin.allTrialAndSubscriptionRequests')}</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-white/60 text-sm mb-1">{t('common.total')}</div>
                    <div className="text-2xl font-bold text-white">{requests?.length || 0}</div>
                </div>
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                    <div className="text-red-400/80 text-sm mb-1">لم يتم التواصل</div>
                    <div className="text-2xl font-bold text-red-400">
                        {requests?.filter(r => !r.contactedAt).length || 0}
                    </div>
                </div>
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                    <div className="text-green-400/80 text-sm mb-1">تم التواصل</div>
                    <div className="text-2xl font-bold text-green-400">
                        {requests?.filter(r => r.contactedAt).length || 0}
                    </div>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                    <div className="text-amber-400/80 text-sm mb-1">الطلبات المحذوفة</div>
                    <div className="text-2xl font-bold text-amber-400">{deletedRequests?.length ?? 0}</div>
                </div>
            </div>

            {/* Filters & Sort */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Status Filters */}
                <div className="flex gap-2 flex-wrap">
                    {([
                        { key: 'all', label: t('common.all') },
                        { key: 'not-contacted', label: t('admin.notContacted') },
                        { key: 'contacted', label: t('admin.contacted') },
                        { key: 'deleted', label: 'المحذوفة' }
                    ] as const).map((filterOption) => (
                        <button
                            key={filterOption.key}
                            onClick={() => setFilter(filterOption.key as any)}
                            className={`px-4 py-2 rounded-lg transition-all ${
                                filter === filterOption.key
                                    ? filterOption.key === 'deleted'
                                        ? 'bg-amber-500/80 text-white'
                                        : 'bg-teal-500 text-white'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                        >
                            {filterOption.label}
                        </button>
                    ))}
                </div>

                {/* Sort Dropdown - hidden in "المحذوفة" tab */}
                {filter !== 'deleted' && (
                    <div className="flex items-center gap-2">
                        <label className="text-white/60 text-sm whitespace-nowrap">ترتيب حسب:</label>
                        <select
                            id="sort-by-select"
                            name="sortBy"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="px-4 py-2 rounded-lg bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 text-white focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-all"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                        >
                            <option value="newest">أحدث طلب</option>
                            <option value="oldest">أقدم طلب</option>
                            <option value="branches-high">{t('admin.totalBranches')} ({t('common.highToLow')})</option>
                            <option value="branches-low">{t('admin.totalBranches')} ({t('common.lowToHigh')})</option>
                        </select>
                    </div>
                )}
            </div>

            {/* سجل المحذوفات */}
            {filter === 'deleted' && (
                <div className="space-y-2">
                    {loadingDeleted ? (
                        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                            <p className="text-white/60">جاري تحميل سجل المحذوفات...</p>
                        </div>
                    ) : !deletedRequests || deletedRequests.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                            <Trash2 className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <p className="text-white/60">لا توجد طلبات محذوفة</p>
                        </div>
                    ) : (
                        deletedRequests.map((request) => (
                            <div
                                key={request.id}
                                className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/20"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                        <Trash2 className="w-4 h-4 text-amber-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-semibold text-white truncate">{request.name}</h3>
                                        <p className="text-white/60 text-xs">{request.phone}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
                                    <span>تاريخ الطلب: {formatDate(request.createdAt)}</span>
                                    <span>•</span>
                                    <span className="text-amber-400/90">تاريخ الحذف: {formatDate(request.deletedAt)}</span>
                                    {request.source && (
                                        <>
                                            <span>•</span>
                                            <span>{request.source === 'about_us_page' ? 'صفحة About Us' : request.source}</span>
                                        </>
                                    )}
                                    {request.requiredBranches != null && (
                                        <>
                                            <span>•</span>
                                            <span className="text-teal-400">{request.requiredBranches} ترخيص</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Requests List - compact rows (when not "المحذوفة") */}
            {filter !== 'deleted' && (
            <div className="space-y-2">
                {!filteredRequests || filteredRequests.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                        <MessageSquare className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <p className="text-white/60">
                            {filter === 'contacted' && 'لا توجد طلبات تم التواصل معها'}
                            {filter === 'not-contacted' && 'لا توجد طلبات معلقة'}
                            {filter === 'all' && 'لا توجد طلبات اشتراك'}
                        </p>
                    </div>
                ) : (
                    filteredRequests.map((request) => (
                        <div
                            key={request.id}
                            className="bg-white/5 rounded-xl p-3 border border-white/10 hover:border-teal-500/30 transition-all"
                        >
                            <div className="flex items-start justify-between flex-wrap gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-9 h-9 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                                            <Users className="w-4 h-4 text-teal-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-base font-semibold text-white truncate">{request.name}</h3>
                                            <p className="text-white/60 text-xs">{request.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap text-xs">
                                        <span className="text-white/50">
                                            تاريخ الطلب: {formatDate(request.createdAt)}
                                        </span>
                                        <span className="text-white/40">•</span>
                                        <span className="text-white/50">{request.source === 'about_us_page' ? 'صفحة About Us' : request.source}</span>
                                        {request.requiredBranches != null && (
                                            <>
                                                <span className="text-white/40">•</span>
                                                <span className="text-teal-400">{request.requiredBranches} ترخيص ({request.requiredBranches} فرع)</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-col sm:flex-row">
                                    {request.contactedAt ? (
                                        <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                                <span className="px-2 py-0.5 rounded text-xs font-semibold border bg-green-500/20 text-green-400 border-green-500/30">
                                                    تم التواصل معه
                                                </span>
                                                <span className="text-xs text-white/40">تاريخ الاتصال: {formatDate(request.contactedAt)}</span>
                                                {request.contactResult && (
                                                    <span className="text-xs text-white/50">
                                                        {request.contactResult === 'demo' && 'طلب ديمو'}
                                                        {request.contactResult === 'thinking' && 'طلب مهلة تفكير'}
                                                        {request.contactResult === 'wrong' && 'طلب خاطئ'}
                                                        {request.contactResult === 'other' && 'طلب آخر'}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => handleViewNotes(request)}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                                                    title={t('admin.viewNotes') || 'عرض الملاحظات'}
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-white/60 hover:text-teal-400" />
                                                </button>
                                                <button
                                                    onClick={() => handlePrintRequest(request)}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                                                    title={t('admin.printDetails') || 'طباعة التفاصيل'}
                                                >
                                                    <Printer className="w-3.5 h-3.5 text-white/60 hover:text-teal-400" />
                                                </button>
                                                <button
                                                    onClick={() => setRequestIdToDelete(request.id!)}
                                                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
                                                    title="حذف الطلب"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                </button>
                                            </div>
                                            <div className="w-full mt-1 pt-2 border-t border-white/10">
                                                <button
                                                    onClick={() => { setSelectedRequestId(request.id!); setShowFollowUpModal(true); }}
                                                    className="w-full px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-400 text-xs font-medium flex items-center justify-center gap-1"
                                                >
                                                    <MessageSquare className="w-3 h-3" />
                                                    متابعة {request.followUps?.length ? `(${request.followUps.length})` : ''}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="px-2 py-0.5 rounded text-xs font-semibold border bg-red-500/20 text-red-400 border-red-500/30">
                                                لم يتم التواصل معه
                                            </span>
                                            <button
                                                onClick={() => handleMarkAsContacted(request.id!)}
                                                className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-medium flex items-center gap-1"
                                            >
                                                <CheckCircle className="w-3.5 h-3.5" />
                                                تم التواصل
                                            </button>
                                            <button
                                                onClick={() => setRequestIdToDelete(request.id!)}
                                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
                                                title="حذف الطلب"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            )}

            {/* Delete confirmation modal — مضغوط ومتوافق مع الثيم */}
            <UnifiedModal
                isOpen={!!requestIdToDelete}
                onClose={() => setRequestIdToDelete(null)}
                title="تأكيد الحذف"
                subtitle="هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع."
                icon={<Trash2 className="w-4 h-4" style={{ color: 'var(--theme-accent-red-dark, #dc2626)' }} />}
                size="xs"
                footer={
                    <ModalActions
                        onCancel={() => setRequestIdToDelete(null)}
                        onConfirm={() => requestIdToDelete && handleConfirmDelete(requestIdToDelete)}
                        cancelText="إلغاء"
                        confirmText="تأكيد الحذف"
                        confirmVariant="danger"
                    />
                }
            >
                <span />
            </UnifiedModal>

            {/* Contact Result Modal */}
            <UnifiedModal
                isOpen={showContactModal}
                onClose={() => {
                    setShowContactModal(false);
                    setSelectedRequestId(null);
                    setContactResult('demo');
                    setContactNotes('');
                }}
                title={t('admin.contactResult') || 'نتيجة الاتصال'}
                subtitle={t('admin.selectRequestTypeAndNotes') || 'اختر نوع الطلب وأضف ملاحظات'}
                icon={<MessageSquare className="w-6 h-6 text-teal-400" />}
                size="md"
            >
                <div className="space-y-4">
                    {/* Contact Result Selection */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            نوع الطلب <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { value: 'demo', label: 'طلب ديمو', icon: '🎮' },
                                { value: 'thinking', label: 'طلب مهلة تفكير', icon: '🤔' },
                                { value: 'wrong', label: 'طلب خاطئ', icon: '❌' },
                                { value: 'other', label: 'طلب آخر', icon: '📝' }
                            ] as const).map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setContactResult(option.value)}
                                    className={`p-3 rounded-xl border-2 transition-all ${
                                        contactResult === option.value
                                            ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                                            : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                                    }`}
                                >
                                    <div className="text-2xl mb-1">{option.icon}</div>
                                    <div className="text-sm font-medium">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contact Notes - REQUIRED */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            الملاحظات <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="contact-notes"
                            name="contactNotes"
                            value={contactNotes}
                            onChange={(e) => setContactNotes(e.target.value)}
                            placeholder="اكتب ملاحظاتك عن الاتصال... (مثال: المشترك يريد تجربة لمدة أسبوع، أو لديه أسئلة عن الأسعار)"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 text-white placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-all resize-none"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            rows={4}
                            dir="rtl"
                            required
                        />
                        {!contactNotes && (
                            <p className="text-red-400 text-xs mt-1">الملاحظات مطلوبة</p>
                        )}
                    </div>
                </div>

                <ModalActions
                    onCancel={() => {
                        setShowContactModal(false);
                        setSelectedRequestId(null);
                        setContactResult('demo');
                        setContactNotes('');
                    }}
                    onConfirm={handleSubmitContact}
                    confirmText={t('common.save')}
                    cancelText={t('common.cancel')}
                    confirmVariant="primary"
                />
            </UnifiedModal>

            {/* View Notes Modal */}
            <UnifiedModal
                isOpen={showNotesModal}
                onClose={() => {
                    setShowNotesModal(false);
                    setSelectedRequest(null);
                }}
                title={t('admin.contactDetails') || 'تفاصيل الاتصال'}
                subtitle={t('admin.contactDetailsSubtitle') || 'تاريخ الطلب، تاريخ الاتصال، والملاحظات'}
                icon={<Eye className="w-6 h-6 text-teal-400" />}
                size="md"
            >
                {selectedRequest && (
                    <div className="space-y-4">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                            <div>
                                <label className="text-xs text-white/60 mb-1 block">تاريخ الطلب</label>
                                <div className="text-white font-medium flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-teal-400" />
                                    {formatDate(selectedRequest.createdAt)}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-white/60 mb-1 block">تاريخ الاتصال</label>
                                <div className="text-white font-medium flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-green-400" />
                                    {selectedRequest.contactedAt ? formatDate(selectedRequest.contactedAt) : 'غير متوفر'}
                                </div>
                            </div>
                            {selectedRequest.contactResult && (
                                <div>
                                    <label className="text-xs text-white/60 mb-1 block">نوع الطلب</label>
                                    <div className="text-white font-medium">
                                        {selectedRequest.contactResult === 'demo' && 'طلب ديمو'}
                                        {selectedRequest.contactResult === 'thinking' && 'طلب مهلة تفكير'}
                                        {selectedRequest.contactResult === 'wrong' && 'طلب خاطئ'}
                                        {selectedRequest.contactResult === 'other' && 'طلب آخر'}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-white/60 mb-2 block">ملاحظات الاتصال</label>
                                <div className="text-white bg-white/5 rounded-lg p-3 border border-white/10 min-h-[100px] text-right">
                                    {selectedRequest.contactNotes || 'لا توجد ملاحظات'}
                                </div>
                            </div>
                            {selectedRequest.followUps && selectedRequest.followUps.length > 0 && (
                                <div>
                                    <label className="text-xs text-white/60 mb-2 block">ملاحظات المتابعة ({selectedRequest.followUps.length})</label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {selectedRequest.followUps.map((followUp, index) => (
                                            <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10 text-right">
                                                <div className="text-xs text-white/40 mb-1">
                                                    {followUp.createdAt?.toDate ? formatDate(followUp.createdAt) : 'تاريخ غير متوفر'}
                                                </div>
                                                <div className="text-white text-sm">{followUp.note}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <ModalActions
                    onCancel={() => {
                        setShowNotesModal(false);
                        setSelectedRequest(null);
                    }}
                    onConfirm={() => {
                        setShowNotesModal(false);
                        setSelectedRequest(null);
                    }}
                    confirmText={t('common.close')}
                    cancelText=""
                    confirmVariant="primary"
                    hideCancel
                />
            </UnifiedModal>

            {/* Follow-up Modal */}
            <UnifiedModal
                isOpen={showFollowUpModal}
                onClose={() => {
                    setShowFollowUpModal(false);
                    setSelectedRequestId(null);
                    setFollowUpNote('');
                }}
                title={t('admin.addFollowUp') || 'إضافة متابعة'}
                subtitle={t('admin.addFollowUpSubtitle') || 'اكتب ملاحظة متابعة للمشترك المحتمل'}
                icon={<MessageSquare className="w-6 h-6 text-teal-400" />}
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            ملاحظة المتابعة <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={followUpNote}
                            onChange={(e) => setFollowUpNote(e.target.value)}
                            placeholder="اكتب ملاحظة المتابعة... (مثال: سيتم الاتصال به مرة أخرى الأسبوع القادم)"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border-2 border-primary-500/40 dark:border-primary-500/30 text-white placeholder-white/40 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:focus:ring-primary-500/40 transition-all resize-none"
                            style={{ boxShadow: '0 2px 8px rgba(20, 184, 166, 0.15), 0 0 0 1px rgba(20, 184, 166, 0.1)' }}
                            rows={4}
                            dir="rtl"
                            required
                        />
                        {!followUpNote && (
                            <p className="text-red-400 text-xs mt-1">ملاحظة المتابعة مطلوبة</p>
                        )}
                    </div>
                </div>

                <ModalActions
                    onCancel={() => {
                        setShowFollowUpModal(false);
                        setSelectedRequestId(null);
                        setFollowUpNote('');
                    }}
                    onConfirm={handleSubmitFollowUp}
                    confirmText={t('common.save')}
                    cancelText={t('common.cancel')}
                    confirmVariant="primary"
                />
            </UnifiedModal>

        </div>
    );
};

export default EnhancedOwnerDashboard;
